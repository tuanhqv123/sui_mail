#[test_only]
module sui_mail::sui_mail_tests;

use std::string;
use sui::test_scenario;
use sui_mail::sui_mail::{Self, UserProfile, Allowlist, Cap};

// Test addresses
const ALICE: address = @0xA11CE;
const BOB: address = @0xB0B;
const CHARLIE: address = @0xC0C0;

// ===== HELPER FUNCTIONS =====

fun create_test_profile(scenario: &mut test_scenario::Scenario, user: address): UserProfile {
    test_scenario::next_tx(scenario, user);
    sui_mail::create_profile(
        test_scenario::ctx(scenario),
    )
}

fun create_test_allowlist(scenario: &mut test_scenario::Scenario, owner: address): Cap {
    test_scenario::next_tx(scenario, owner);
    sui_mail::create_allowlist(
        string::utf8(b"Test Allowlist"),
        string::utf8(b"Test Description"),
        test_scenario::ctx(scenario),
    )
}

// ===== 1. USER PROFILE TESTS =====

#[test]
fun test_create_profile() {
    let mut scenario = test_scenario::begin(ALICE);

    let profile = create_test_profile(&mut scenario, ALICE);

    // Verify profile
    assert!(sui_mail::get_profile_owner(&profile) == ALICE, 0);
    assert!(sui_mail::get_profile_blacklist_count(&profile) == 0, 1);

    sui_mail::destroy_profile_for_testing(profile);
    test_scenario::end(scenario);
}

#[test]
fun test_add_to_blacklist() {
    let mut scenario = test_scenario::begin(ALICE);

    let mut profile = create_test_profile(&mut scenario, ALICE);

    // Alice blacklists Bob
    test_scenario::next_tx(&mut scenario, ALICE);
    sui_mail::add_to_blacklist(
        &mut profile,
        BOB,
        string::utf8(b"Spammer"),
        test_scenario::ctx(&mut scenario),
    );

    // Verify Bob is blacklisted
    assert!(sui_mail::is_blacklisted(&profile, BOB), 0);
    assert!(sui_mail::get_profile_blacklist_count(&profile) == 1, 1);

    sui_mail::destroy_profile_for_testing(profile);
    test_scenario::end(scenario);
}

#[test]
fun test_remove_from_blacklist() {
    let mut scenario = test_scenario::begin(ALICE);

    let mut profile = create_test_profile(&mut scenario, ALICE);

    // Alice blacklists Bob
    test_scenario::next_tx(&mut scenario, ALICE);
    sui_mail::add_to_blacklist(
        &mut profile,
        BOB,
        string::utf8(b"Spammer"),
        test_scenario::ctx(&mut scenario),
    );

    // Alice removes Bob from blacklist
    test_scenario::next_tx(&mut scenario, ALICE);
    sui_mail::remove_from_blacklist(
        &mut profile,
        BOB,
        test_scenario::ctx(&mut scenario),
    );

    // Verify Bob is not blacklisted
    assert!(!sui_mail::is_blacklisted(&profile, BOB), 0);
    assert!(sui_mail::get_profile_blacklist_count(&profile) == 0, 1);

    sui_mail::destroy_profile_for_testing(profile);
    test_scenario::end(scenario);
}

#[test]
#[expected_failure(abort_code = 5)] // EDuplicate
fun test_duplicate_blacklist_fails() {
    let mut scenario = test_scenario::begin(ALICE);

    let mut profile = create_test_profile(&mut scenario, ALICE);

    // Alice blacklists Bob
    test_scenario::next_tx(&mut scenario, ALICE);
    sui_mail::add_to_blacklist(
        &mut profile,
        BOB,
        string::utf8(b"Spammer"),
        test_scenario::ctx(&mut scenario),
    );

    // Try to blacklist Bob again - should fail
    test_scenario::next_tx(&mut scenario, ALICE);
    sui_mail::add_to_blacklist(
        &mut profile,
        BOB,
        string::utf8(b"Spammer"),
        test_scenario::ctx(&mut scenario),
    );

    sui_mail::destroy_profile_for_testing(profile);
    test_scenario::end(scenario);
}

#[test]
#[expected_failure(abort_code = 7)] // ENotOwner
fun test_blacklist_only_owner() {
    let mut scenario = test_scenario::begin(ALICE);

    let mut profile = create_test_profile(&mut scenario, ALICE);

    // Bob tries to blacklist Charlie using Alice's profile - should fail
    test_scenario::next_tx(&mut scenario, BOB);
    sui_mail::add_to_blacklist(
        &mut profile,
        CHARLIE,
        string::utf8(b"Test"),
        test_scenario::ctx(&mut scenario),
    );

    sui_mail::destroy_profile_for_testing(profile);
    test_scenario::end(scenario);
}

// ===== 2. ALLOWLIST TESTS =====

#[test]
fun test_create_allowlist() {
    let mut scenario = test_scenario::begin(ALICE);

    let cap = create_test_allowlist(&mut scenario, ALICE);

    // Get the shared allowlist
    test_scenario::next_tx(&mut scenario, ALICE);
    let allowlist = test_scenario::take_shared<Allowlist>(&scenario);

    // Verify allowlist
    assert!(sui_mail::get_allowlist_owner(&allowlist) == ALICE, 0);
    assert!(sui_mail::get_allowlist_member_count(&allowlist) == 0, 1);

    test_scenario::return_shared(allowlist);
    sui_mail::destroy_cap_for_testing(cap);
    test_scenario::end(scenario);
}

#[test]
fun test_add_member() {
    let mut scenario = test_scenario::begin(ALICE);

    // Create profiles
    let alice_profile = create_test_profile(&mut scenario, ALICE);
    let bob_profile = create_test_profile(&mut scenario, BOB);

    // Create allowlist
    let cap = create_test_allowlist(&mut scenario, ALICE);

    // Get the shared allowlist
    test_scenario::next_tx(&mut scenario, ALICE);
    let mut allowlist = test_scenario::take_shared<Allowlist>(&scenario);

    // Alice adds Bob to allowlist
    sui_mail::add_member(
        &mut allowlist,
        &cap,
        BOB,
        &bob_profile,
        test_scenario::ctx(&mut scenario),
    );

    // Verify Bob is member
    assert!(sui_mail::is_member(&allowlist, BOB), 0);
    assert!(sui_mail::get_allowlist_member_count(&allowlist) == 1, 1);

    test_scenario::return_shared(allowlist);
    sui_mail::destroy_profile_for_testing(alice_profile);
    sui_mail::destroy_profile_for_testing(bob_profile);
    sui_mail::destroy_cap_for_testing(cap);
    test_scenario::end(scenario);
}

#[test]
#[expected_failure(abort_code = 2)] // EUserBlacklisted
fun test_add_member_fails_when_blacklisted() {
    let mut scenario = test_scenario::begin(ALICE);

    // Create profiles
    let alice_profile = create_test_profile(&mut scenario, ALICE);
    let mut bob_profile = create_test_profile(&mut scenario, BOB);

    // Bob blacklists Alice
    test_scenario::next_tx(&mut scenario, BOB);
    sui_mail::add_to_blacklist(
        &mut bob_profile,
        ALICE,
        string::utf8(b"Privacy"),
        test_scenario::ctx(&mut scenario),
    );

    // Create allowlist
    let cap = create_test_allowlist(&mut scenario, ALICE);

    // Get the shared allowlist
    test_scenario::next_tx(&mut scenario, ALICE);
    let mut allowlist = test_scenario::take_shared<Allowlist>(&scenario);

    // Alice tries to add Bob to allowlist - should fail
    sui_mail::add_member(
        &mut allowlist,
        &cap,
        BOB,
        &bob_profile,
        test_scenario::ctx(&mut scenario),
    );

    test_scenario::return_shared(allowlist);
    sui_mail::destroy_profile_for_testing(alice_profile);
    sui_mail::destroy_profile_for_testing(bob_profile);
    sui_mail::destroy_cap_for_testing(cap);
    test_scenario::end(scenario);
}

#[test]
fun test_remove_member() {
    let mut scenario = test_scenario::begin(ALICE);

    // Setup: Add Bob to allowlist
    let alice_profile = create_test_profile(&mut scenario, ALICE);
    let bob_profile = create_test_profile(&mut scenario, BOB);
    let cap = create_test_allowlist(&mut scenario, ALICE);
    test_scenario::next_tx(&mut scenario, ALICE);
    let mut allowlist = test_scenario::take_shared<Allowlist>(&scenario);

    test_scenario::next_tx(&mut scenario, ALICE);
    sui_mail::add_member(
        &mut allowlist,
        &cap,
        BOB,
        &bob_profile,
        test_scenario::ctx(&mut scenario),
    );

    // Alice removes Bob
    test_scenario::next_tx(&mut scenario, ALICE);
    sui_mail::remove_member(
        &mut allowlist,
        &cap,
        BOB,
        test_scenario::ctx(&mut scenario),
    );

    // Verify Bob is not member
    assert!(!sui_mail::is_member(&allowlist, BOB), 0);
    assert!(sui_mail::get_allowlist_member_count(&allowlist) == 0, 1);

    test_scenario::return_shared(allowlist);
    sui_mail::destroy_profile_for_testing(alice_profile);
    sui_mail::destroy_profile_for_testing(bob_profile);
    sui_mail::destroy_cap_for_testing(cap);
    test_scenario::end(scenario);
}

#[test]
#[expected_failure(abort_code = 5)] // EDuplicate
fun test_duplicate_member_fails() {
    let mut scenario = test_scenario::begin(ALICE);

    let alice_profile = create_test_profile(&mut scenario, ALICE);
    let bob_profile = create_test_profile(&mut scenario, BOB);
    let cap = create_test_allowlist(&mut scenario, ALICE);
    test_scenario::next_tx(&mut scenario, ALICE);
    let mut allowlist = test_scenario::take_shared<Allowlist>(&scenario);

    // Add Bob first time
    test_scenario::next_tx(&mut scenario, ALICE);
    sui_mail::add_member(
        &mut allowlist,
        &cap,
        BOB,
        &bob_profile,
        test_scenario::ctx(&mut scenario),
    );

    // Try to add Bob again - should fail
    test_scenario::next_tx(&mut scenario, ALICE);
    sui_mail::add_member(
        &mut allowlist,
        &cap,
        BOB,
        &bob_profile,
        test_scenario::ctx(&mut scenario),
    );

    test_scenario::return_shared(allowlist);
    sui_mail::destroy_profile_for_testing(alice_profile);
    sui_mail::destroy_profile_for_testing(bob_profile);
    sui_mail::destroy_cap_for_testing(cap);
    test_scenario::end(scenario);
}

// ===== 3. MAIL TESTS ===

#[test]
fun test_create_mail() {
    let mut scenario = test_scenario::begin(ALICE);

    let alice_profile = create_test_profile(&mut scenario, ALICE);
    let bob_profile = create_test_profile(&mut scenario, BOB);
    let cap = create_test_allowlist(&mut scenario, ALICE);
    test_scenario::next_tx(&mut scenario, ALICE);
    let mut allowlist = test_scenario::take_shared<Allowlist>(&scenario);

    // Add Alice and Bob to allowlist
    test_scenario::next_tx(&mut scenario, ALICE);
    sui_mail::add_member(
        &mut allowlist,
        &cap,
        ALICE,
        &alice_profile,
        test_scenario::ctx(&mut scenario),
    );
    sui_mail::add_member(
        &mut allowlist,
        &cap,
        BOB,
        &bob_profile,
        test_scenario::ctx(&mut scenario),
    );

    // Alice creates mail
    test_scenario::next_tx(&mut scenario, ALICE);
    let mail = sui_mail::create_mail(
        string::utf8(b"Test Subject"),
        string::utf8(b"blob_123"),
        &allowlist,
        test_scenario::ctx(&mut scenario),
    );

    // Verify mail
    assert!(sui_mail::get_mail_sender(&mail) == ALICE, 0);
    assert!(sui_mail::get_mail_reply_count(&mail) == 0, 1);

    test_scenario::return_shared(allowlist);
    sui_mail::destroy_profile_for_testing(alice_profile);
    sui_mail::destroy_profile_for_testing(bob_profile);
    sui_mail::destroy_cap_for_testing(cap);
    sui_mail::destroy_mail_for_testing(mail);
    test_scenario::end(scenario);
}

#[test]
#[expected_failure(abort_code = 3)] // ENotMember
fun test_create_mail_non_member_fails() {
    let mut scenario = test_scenario::begin(ALICE);

    let alice_profile = create_test_profile(&mut scenario, ALICE);
    let cap = create_test_allowlist(&mut scenario, ALICE);
    test_scenario::next_tx(&mut scenario, ALICE);
    let mut allowlist = test_scenario::take_shared<Allowlist>(&scenario);

    // Bob (not a member) tries to create mail - should fail
    test_scenario::next_tx(&mut scenario, BOB);
    let mail = sui_mail::create_mail(
        string::utf8(b"Test Subject"),
        string::utf8(b"blob_123"),
        &allowlist,
        test_scenario::ctx(&mut scenario),
    );

    test_scenario::return_shared(allowlist);
    sui_mail::destroy_profile_for_testing(alice_profile);
    sui_mail::destroy_cap_for_testing(cap);
    sui_mail::destroy_mail_for_testing(mail);
    test_scenario::end(scenario);
}

#[test]
fun test_add_reply() {
    let mut scenario = test_scenario::begin(ALICE);

    // Setup allowlist with Alice and Bob
    let alice_profile = create_test_profile(&mut scenario, ALICE);
    let bob_profile = create_test_profile(&mut scenario, BOB);
    let cap = create_test_allowlist(&mut scenario, ALICE);
    test_scenario::next_tx(&mut scenario, ALICE);
    let mut allowlist = test_scenario::take_shared<Allowlist>(&scenario);

    test_scenario::next_tx(&mut scenario, ALICE);
    sui_mail::add_member(
        &mut allowlist,
        &cap,
        ALICE,
        &alice_profile,
        test_scenario::ctx(&mut scenario),
    );
    sui_mail::add_member(
        &mut allowlist,
        &cap,
        BOB,
        &bob_profile,
        test_scenario::ctx(&mut scenario),
    );

    // Alice creates mail
    test_scenario::next_tx(&mut scenario, ALICE);
    let mut parent_mail = sui_mail::create_mail(
        string::utf8(b"Original"),
        string::utf8(b"blob_1"),
        &allowlist,
        test_scenario::ctx(&mut scenario),
    );

    // Bob creates reply
    test_scenario::next_tx(&mut scenario, BOB);
    let reply_mail = sui_mail::create_mail(
        string::utf8(b"Reply"),
        string::utf8(b"blob_2"),
        &allowlist,
        test_scenario::ctx(&mut scenario),
    );

    // Add reply to parent
    test_scenario::next_tx(&mut scenario, BOB);
    sui_mail::add_reply(
        &mut parent_mail,
        &reply_mail,
        test_scenario::ctx(&mut scenario),
    );

    // Verify reply count
    assert!(sui_mail::get_mail_reply_count(&parent_mail) == 1, 0);

    test_scenario::return_shared(allowlist);
    sui_mail::destroy_profile_for_testing(alice_profile);
    sui_mail::destroy_profile_for_testing(bob_profile);
    sui_mail::destroy_cap_for_testing(cap);
    sui_mail::destroy_mail_for_testing(parent_mail);
    sui_mail::destroy_mail_for_testing(reply_mail);
    test_scenario::end(scenario);
}

// ===== 4. SEAL IBE TESTS =====

#[test]
fun test_namespace_generation() {
    let mut scenario = test_scenario::begin(ALICE);

    let cap = create_test_allowlist(&mut scenario, ALICE);

    test_scenario::next_tx(&mut scenario, ALICE);
    let allowlist = test_scenario::take_shared<Allowlist>(&scenario);

    // Generate namespace
    let namespace = sui_mail::namespace(&allowlist);

    // Verify namespace is not empty
    assert!(namespace.length() > 0, 0);

    test_scenario::return_shared(allowlist);
    sui_mail::destroy_cap_for_testing(cap);
    test_scenario::end(scenario);
}

// ===== 5. MAIL RETRIEVAL TESTS =====

#[test]
fun test_get_mail_details() {
    let mut scenario = test_scenario::begin(ALICE);

    let alice_profile = create_test_profile(&mut scenario, ALICE);
    let bob_profile = create_test_profile(&mut scenario, BOB);
    let cap = create_test_allowlist(&mut scenario, ALICE);
    test_scenario::next_tx(&mut scenario, ALICE);
    let mut allowlist = test_scenario::take_shared<Allowlist>(&scenario);

    // Add Alice and Bob to allowlist
    sui_mail::add_member(
        &mut allowlist,
        &cap,
        ALICE,
        &alice_profile,
        test_scenario::ctx(&mut scenario),
    );
    sui_mail::add_member(
        &mut allowlist,
        &cap,
        BOB,
        &bob_profile,
        test_scenario::ctx(&mut scenario),
    );

    // Alice creates mail
    test_scenario::next_tx(&mut scenario, ALICE);
    let mail = sui_mail::create_mail(
        string::utf8(b"Important Message"),
        string::utf8(b"encrypted_blob_abc123"),
        &allowlist,
        test_scenario::ctx(&mut scenario),
    );

    // Verify all mail details can be retrieved
    assert!(sui_mail::get_mail_sender(&mail) == ALICE, 0);
    assert!(sui_mail::get_mail_subject(&mail) == string::utf8(b"Important Message"), 1);
    assert!(sui_mail::get_mail_blob_id(&mail) == string::utf8(b"encrypted_blob_abc123"), 2);
    assert!(sui_mail::get_mail_allowlist_id(&mail) == sui::object::id(&allowlist), 3);
    assert!(sui_mail::get_mail_reply_count(&mail) == 0, 4);
    // Timestamp is epoch-based, just verify it exists
    let _timestamp = sui_mail::get_mail_timestamp(&mail);

    test_scenario::return_shared(allowlist);
    sui_mail::destroy_profile_for_testing(alice_profile);
    sui_mail::destroy_profile_for_testing(bob_profile);
    sui_mail::destroy_cap_for_testing(cap);
    sui_mail::destroy_mail_for_testing(mail);
    test_scenario::end(scenario);
}

#[test]
fun test_read_mail_by_member() {
    let mut scenario = test_scenario::begin(ALICE);

    let alice_profile = create_test_profile(&mut scenario, ALICE);
    let bob_profile = create_test_profile(&mut scenario, BOB);
    let cap = create_test_allowlist(&mut scenario, ALICE);
    test_scenario::next_tx(&mut scenario, ALICE);
    let mut allowlist = test_scenario::take_shared<Allowlist>(&scenario);

    // Add Alice and Bob to allowlist
    sui_mail::add_member(
        &mut allowlist,
        &cap,
        ALICE,
        &alice_profile,
        test_scenario::ctx(&mut scenario),
    );
    sui_mail::add_member(
        &mut allowlist,
        &cap,
        BOB,
        &bob_profile,
        test_scenario::ctx(&mut scenario),
    );

    // Alice sends mail to the allowlist
    test_scenario::next_tx(&mut scenario, ALICE);
    let mail = sui_mail::create_mail(
        string::utf8(b"Hello Bob"),
        string::utf8(b"blob_xyz789"),
        &allowlist,
        test_scenario::ctx(&mut scenario),
    );

    // Bob can read the mail (he's a member)
    test_scenario::next_tx(&mut scenario, BOB);
    assert!(sui_mail::is_member(&allowlist, BOB), 0);

    // Bob can access mail details
    let subject = sui_mail::get_mail_subject(&mail);
    let blob_id = sui_mail::get_mail_blob_id(&mail);
    assert!(subject == string::utf8(b"Hello Bob"), 1);
    assert!(blob_id == string::utf8(b"blob_xyz789"), 2);

    test_scenario::return_shared(allowlist);
    sui_mail::destroy_profile_for_testing(alice_profile);
    sui_mail::destroy_profile_for_testing(bob_profile);
    sui_mail::destroy_cap_for_testing(cap);
    sui_mail::destroy_mail_for_testing(mail);
    test_scenario::end(scenario);
}

#[test]
fun test_list_multiple_sent_mails() {
    let mut scenario = test_scenario::begin(ALICE);

    let alice_profile = create_test_profile(&mut scenario, ALICE);
    let bob_profile = create_test_profile(&mut scenario, BOB);
    let cap = create_test_allowlist(&mut scenario, ALICE);
    test_scenario::next_tx(&mut scenario, ALICE);
    let mut allowlist = test_scenario::take_shared<Allowlist>(&scenario);

    // Add Alice and Bob to allowlist
    sui_mail::add_member(
        &mut allowlist,
        &cap,
        ALICE,
        &alice_profile,
        test_scenario::ctx(&mut scenario),
    );
    sui_mail::add_member(
        &mut allowlist,
        &cap,
        BOB,
        &bob_profile,
        test_scenario::ctx(&mut scenario),
    );

    // Alice sends multiple mails
    test_scenario::next_tx(&mut scenario, ALICE);
    let mail1 = sui_mail::create_mail(
        string::utf8(b"First Message"),
        string::utf8(b"blob_001"),
        &allowlist,
        test_scenario::ctx(&mut scenario),
    );

    let mail2 = sui_mail::create_mail(
        string::utf8(b"Second Message"),
        string::utf8(b"blob_002"),
        &allowlist,
        test_scenario::ctx(&mut scenario),
    );

    let mail3 = sui_mail::create_mail(
        string::utf8(b"Third Message"),
        string::utf8(b"blob_003"),
        &allowlist,
        test_scenario::ctx(&mut scenario),
    );

    // Verify all mails were created by Alice
    assert!(sui_mail::get_mail_sender(&mail1) == ALICE, 0);
    assert!(sui_mail::get_mail_sender(&mail2) == ALICE, 1);
    assert!(sui_mail::get_mail_sender(&mail3) == ALICE, 2);

    // Verify subjects are correct
    assert!(sui_mail::get_mail_subject(&mail1) == string::utf8(b"First Message"), 3);
    assert!(sui_mail::get_mail_subject(&mail2) == string::utf8(b"Second Message"), 4);
    assert!(sui_mail::get_mail_subject(&mail3) == string::utf8(b"Third Message"), 5);

    // Verify blob IDs
    assert!(sui_mail::get_mail_blob_id(&mail1) == string::utf8(b"blob_001"), 6);
    assert!(sui_mail::get_mail_blob_id(&mail2) == string::utf8(b"blob_002"), 7);
    assert!(sui_mail::get_mail_blob_id(&mail3) == string::utf8(b"blob_003"), 8);

    test_scenario::return_shared(allowlist);
    sui_mail::destroy_profile_for_testing(alice_profile);
    sui_mail::destroy_profile_for_testing(bob_profile);
    sui_mail::destroy_cap_for_testing(cap);
    sui_mail::destroy_mail_for_testing(mail1);
    sui_mail::destroy_mail_for_testing(mail2);
    sui_mail::destroy_mail_for_testing(mail3);
    test_scenario::end(scenario);
}

#[test]
fun test_mail_with_replies_details() {
    let mut scenario = test_scenario::begin(ALICE);

    let alice_profile = create_test_profile(&mut scenario, ALICE);
    let bob_profile = create_test_profile(&mut scenario, BOB);
    let cap = create_test_allowlist(&mut scenario, ALICE);
    test_scenario::next_tx(&mut scenario, ALICE);
    let mut allowlist = test_scenario::take_shared<Allowlist>(&scenario);

    // Add Alice and Bob to allowlist
    sui_mail::add_member(
        &mut allowlist,
        &cap,
        ALICE,
        &alice_profile,
        test_scenario::ctx(&mut scenario),
    );
    sui_mail::add_member(
        &mut allowlist,
        &cap,
        BOB,
        &bob_profile,
        test_scenario::ctx(&mut scenario),
    );

    // Alice creates original mail
    test_scenario::next_tx(&mut scenario, ALICE);
    let mut parent_mail = sui_mail::create_mail(
        string::utf8(b"Original Message"),
        string::utf8(b"blob_parent"),
        &allowlist,
        test_scenario::ctx(&mut scenario),
    );

    // Bob creates first reply
    test_scenario::next_tx(&mut scenario, BOB);
    let reply1 = sui_mail::create_mail(
        string::utf8(b"Re: Original Message"),
        string::utf8(b"blob_reply1"),
        &allowlist,
        test_scenario::ctx(&mut scenario),
    );

    // Alice creates second reply
    test_scenario::next_tx(&mut scenario, ALICE);
    let reply2 = sui_mail::create_mail(
        string::utf8(b"Re: Re: Original Message"),
        string::utf8(b"blob_reply2"),
        &allowlist,
        test_scenario::ctx(&mut scenario),
    );

    // Add replies to parent
    sui_mail::add_reply(&mut parent_mail, &reply1, test_scenario::ctx(&mut scenario));
    sui_mail::add_reply(&mut parent_mail, &reply2, test_scenario::ctx(&mut scenario));

    // Verify parent mail details
    assert!(sui_mail::get_mail_sender(&parent_mail) == ALICE, 0);
    assert!(sui_mail::get_mail_reply_count(&parent_mail) == 2, 1);

    // Verify reply details
    assert!(sui_mail::get_mail_sender(&reply1) == BOB, 2);
    assert!(sui_mail::get_mail_sender(&reply2) == ALICE, 3);
    assert!(sui_mail::get_mail_subject(&reply1) == string::utf8(b"Re: Original Message"), 4);
    assert!(sui_mail::get_mail_subject(&reply2) == string::utf8(b"Re: Re: Original Message"), 5);

    test_scenario::return_shared(allowlist);
    sui_mail::destroy_profile_for_testing(alice_profile);
    sui_mail::destroy_profile_for_testing(bob_profile);
    sui_mail::destroy_cap_for_testing(cap);
    sui_mail::destroy_mail_for_testing(parent_mail);
    sui_mail::destroy_mail_for_testing(reply1);
    sui_mail::destroy_mail_for_testing(reply2);
    test_scenario::end(scenario);
}

// ===== 6. INTEGRATION TESTS =====

#[test]
fun test_full_mail_flow() {
    let mut scenario = test_scenario::begin(ALICE);

    // 1. Create profiles
    let alice_profile = create_test_profile(&mut scenario, ALICE);
    let bob_profile = create_test_profile(&mut scenario, BOB);

    // 2. Alice creates allowlist
    let cap = create_test_allowlist(&mut scenario, ALICE);

    test_scenario::next_tx(&mut scenario, ALICE);
    let mut allowlist = test_scenario::take_shared<Allowlist>(&scenario);

    // 3. Alice adds herself and Bob
    sui_mail::add_member(
        &mut allowlist,
        &cap,
        ALICE,
        &alice_profile,
        test_scenario::ctx(&mut scenario),
    );
    sui_mail::add_member(
        &mut allowlist,
        &cap,
        BOB,
        &bob_profile,
        test_scenario::ctx(&mut scenario),
    );

    // 4. Alice sends mail
    test_scenario::next_tx(&mut scenario, ALICE);
    let mail = sui_mail::create_mail(
        string::utf8(b"Hello Bob!"),
        string::utf8(b"encrypted_blob_123"),
        &allowlist,
        test_scenario::ctx(&mut scenario),
    );

    // 5. Verify Bob can read (is member)
    assert!(sui_mail::is_member(&allowlist, BOB), 0);

    // 6. Verify Charlie cannot read (not member)
    assert!(!sui_mail::is_member(&allowlist, CHARLIE), 1);

    // Cleanup
    test_scenario::return_shared(allowlist);
    sui_mail::destroy_profile_for_testing(alice_profile);
    sui_mail::destroy_profile_for_testing(bob_profile);
    sui_mail::destroy_cap_for_testing(cap);
    sui_mail::destroy_mail_for_testing(mail);
    test_scenario::end(scenario);
}
