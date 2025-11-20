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
    sui_mail::create_profile(test_scenario::ctx(scenario))
}

fun create_test_allowlist(scenario: &mut test_scenario::Scenario, owner: address): Cap {
    test_scenario::next_tx(scenario, owner);
    sui_mail::create_allowlist(
        string::utf8(b"Test Allowlist"),
        string::utf8(b"Test Description"),
        test_scenario::ctx(scenario),
    )
}

// ===== TESTS =====

#[test]
fun test_create_profile() {
    let mut scenario = test_scenario::begin(ALICE);
    let profile = create_test_profile(&mut scenario, ALICE);

    assert!(sui_mail::get_profile_owner(&profile) == ALICE, 0);
    assert!(sui_mail::get_profile_blacklist_count(&profile) == 0, 1);

    sui_mail::destroy_profile_for_testing(profile);
    test_scenario::end(scenario);
}

#[test]
fun test_add_to_blacklist() {
    let mut scenario = test_scenario::begin(ALICE);
    let mut profile = create_test_profile(&mut scenario, ALICE);

    test_scenario::next_tx(&mut scenario, ALICE);
    sui_mail::add_to_blacklist(
        &mut profile,
        BOB,
        string::utf8(b"Spammer"),
        test_scenario::ctx(&mut scenario),
    );

    assert!(sui_mail::is_blacklisted(&profile, BOB), 0);
    assert!(sui_mail::get_profile_blacklist_count(&profile) == 1, 1);

    sui_mail::destroy_profile_for_testing(profile);
    test_scenario::end(scenario);
}

#[test]
fun test_remove_from_blacklist() {
    let mut scenario = test_scenario::begin(ALICE);
    let mut profile = create_test_profile(&mut scenario, ALICE);

    test_scenario::next_tx(&mut scenario, ALICE);
    sui_mail::add_to_blacklist(
        &mut profile,
        BOB,
        string::utf8(b"Spammer"),
        test_scenario::ctx(&mut scenario),
    );

    test_scenario::next_tx(&mut scenario, ALICE);
    sui_mail::remove_from_blacklist(
        &mut profile,
        BOB,
        test_scenario::ctx(&mut scenario),
    );

    assert!(!sui_mail::is_blacklisted(&profile, BOB), 0);
    assert!(sui_mail::get_profile_blacklist_count(&profile) == 0, 1);

    sui_mail::destroy_profile_for_testing(profile);
    test_scenario::end(scenario);
}

#[test]
#[expected_failure] // Should abort with EDuplicate
fun test_duplicate_blacklist_fails() {
    let mut scenario = test_scenario::begin(ALICE);
    let mut profile = create_test_profile(&mut scenario, ALICE);

    test_scenario::next_tx(&mut scenario, ALICE);
    sui_mail::add_to_blacklist(
        &mut profile,
        BOB,
        string::utf8(b"Spammer"),
        test_scenario::ctx(&mut scenario),
    );

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
#[expected_failure] // Should abort with ENotOwner
fun test_blacklist_only_owner() {
    let mut scenario = test_scenario::begin(ALICE);
    let mut profile = create_test_profile(&mut scenario, ALICE);

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

#[test]
fun test_create_allowlist() {
    let mut scenario = test_scenario::begin(ALICE);
    let cap = create_test_allowlist(&mut scenario, ALICE);

    test_scenario::next_tx(&mut scenario, ALICE);
    let allowlist = test_scenario::take_shared<Allowlist>(&scenario);

    assert!(sui_mail::get_allowlist_owner(&allowlist) == ALICE, 0);
    assert!(sui_mail::get_allowlist_member_count(&allowlist) == 0, 1);

    test_scenario::return_shared(allowlist);
    sui_mail::destroy_cap_for_testing(cap);
    test_scenario::end(scenario);
}

#[test]
fun test_add_member() {
    let mut scenario = test_scenario::begin(ALICE);
    let alice_profile = create_test_profile(&mut scenario, ALICE);
    let bob_profile = create_test_profile(&mut scenario, BOB);
    let cap = create_test_allowlist(&mut scenario, ALICE);

    test_scenario::next_tx(&mut scenario, ALICE);
    let mut allowlist = test_scenario::take_shared<Allowlist>(&scenario);

    sui_mail::add_member(
        &mut allowlist,
        &cap,
        BOB,
        &bob_profile,
        test_scenario::ctx(&mut scenario),
    );

    assert!(sui_mail::is_member(&allowlist, BOB), 0);
    assert!(sui_mail::get_allowlist_member_count(&allowlist) == 1, 1);

    test_scenario::return_shared(allowlist);
    sui_mail::destroy_profile_for_testing(alice_profile);
    sui_mail::destroy_profile_for_testing(bob_profile);
    sui_mail::destroy_cap_for_testing(cap);
    test_scenario::end(scenario);
}

#[test]
#[expected_failure] // Should abort with EUserBlacklisted
fun test_add_member_fails_when_blacklisted() {
    let mut scenario = test_scenario::begin(ALICE);
    let alice_profile = create_test_profile(&mut scenario, ALICE);
    let mut bob_profile = create_test_profile(&mut scenario, BOB);

    test_scenario::next_tx(&mut scenario, BOB);
    sui_mail::add_to_blacklist(
        &mut bob_profile,
        ALICE,
        string::utf8(b"Privacy"),
        test_scenario::ctx(&mut scenario),
    );

    let cap = create_test_allowlist(&mut scenario, ALICE);
    test_scenario::next_tx(&mut scenario, ALICE);
    let mut allowlist = test_scenario::take_shared<Allowlist>(&scenario);

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

    test_scenario::next_tx(&mut scenario, ALICE);
    sui_mail::remove_member(
        &mut allowlist,
        &cap,
        BOB,
        test_scenario::ctx(&mut scenario),
    );

    assert!(!sui_mail::is_member(&allowlist, BOB), 0);
    assert!(sui_mail::get_allowlist_member_count(&allowlist) == 0, 1);

    test_scenario::return_shared(allowlist);
    sui_mail::destroy_profile_for_testing(alice_profile);
    sui_mail::destroy_profile_for_testing(bob_profile);
    sui_mail::destroy_cap_for_testing(cap);
    test_scenario::end(scenario);
}

#[test]
#[expected_failure] // Should abort with EDuplicate
fun test_duplicate_member_fails() {
    let mut scenario = test_scenario::begin(ALICE);
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

#[test]
fun test_create_mail() {
    let mut scenario = test_scenario::begin(ALICE);
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

    test_scenario::next_tx(&mut scenario, ALICE);
    let mail = sui_mail::create_mail(
        string::utf8(b"Test Subject"),
        string::utf8(b"blob_123"),
        &allowlist,
        test_scenario::ctx(&mut scenario),
    );

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
#[expected_failure] // Should abort with ENotMember
fun test_create_mail_non_member_fails() {
    let mut scenario = test_scenario::begin(ALICE);
    let alice_profile = create_test_profile(&mut scenario, ALICE);
    let cap = create_test_allowlist(&mut scenario, ALICE);

    test_scenario::next_tx(&mut scenario, ALICE);
    let allowlist = test_scenario::take_shared<Allowlist>(&scenario);

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

    test_scenario::next_tx(&mut scenario, ALICE);
    let mut parent_mail = sui_mail::create_mail(
        string::utf8(b"Original"),
        string::utf8(b"blob_1"),
        &allowlist,
        test_scenario::ctx(&mut scenario),
    );

    test_scenario::next_tx(&mut scenario, BOB);
    let reply_mail = sui_mail::create_mail(
        string::utf8(b"Reply"),
        string::utf8(b"blob_2"),
        &allowlist,
        test_scenario::ctx(&mut scenario),
    );

    test_scenario::next_tx(&mut scenario, BOB);
    sui_mail::add_reply(
        &mut parent_mail,
        &reply_mail,
        test_scenario::ctx(&mut scenario),
    );

    assert!(sui_mail::get_mail_reply_count(&parent_mail) == 1, 0);

    test_scenario::return_shared(allowlist);
    sui_mail::destroy_profile_for_testing(alice_profile);
    sui_mail::destroy_profile_for_testing(bob_profile);
    sui_mail::destroy_cap_for_testing(cap);
    sui_mail::destroy_mail_for_testing(parent_mail);
    sui_mail::destroy_mail_for_testing(reply_mail);
    test_scenario::end(scenario);
}

#[test]
fun test_namespace_generation() {
    let mut scenario = test_scenario::begin(ALICE);
    let cap = create_test_allowlist(&mut scenario, ALICE);

    test_scenario::next_tx(&mut scenario, ALICE);
    let allowlist = test_scenario::take_shared<Allowlist>(&scenario);

    let namespace = sui_mail::namespace(&allowlist);
    assert!(namespace.length() > 0, 0);

    test_scenario::return_shared(allowlist);
    sui_mail::destroy_cap_for_testing(cap);
    test_scenario::end(scenario);
}

#[test]
fun test_full_mail_flow() {
    let mut scenario = test_scenario::begin(ALICE);
    let alice_profile = create_test_profile(&mut scenario, ALICE);
    let bob_profile = create_test_profile(&mut scenario, BOB);
    let cap = create_test_allowlist(&mut scenario, ALICE);

    test_scenario::next_tx(&mut scenario, ALICE);
    let mut allowlist = test_scenario::take_shared<Allowlist>(&scenario);

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

    test_scenario::next_tx(&mut scenario, ALICE);
    let mail = sui_mail::create_mail(
        string::utf8(b"Hello Bob!"),
        string::utf8(b"encrypted_blob_123"),
        &allowlist,
        test_scenario::ctx(&mut scenario),
    );

    assert!(sui_mail::is_member(&allowlist, BOB), 0);
    assert!(!sui_mail::is_member(&allowlist, CHARLIE), 1);

    test_scenario::return_shared(allowlist);
    sui_mail::destroy_profile_for_testing(alice_profile);
    sui_mail::destroy_profile_for_testing(bob_profile);
    sui_mail::destroy_cap_for_testing(cap);
    sui_mail::destroy_mail_for_testing(mail);
    test_scenario::end(scenario);
}
