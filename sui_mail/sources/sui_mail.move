/// # Secure Mail - Production Smart Contract
///
/// A decentralized, end-to-end encrypted email system on Sui blockchain
module sui_mail::sui_mail;

use std::string::{Self, String};
use sui::dynamic_field as df;
use sui::event;
use sui::package;

// ===== CONSTANTS =====

const VERSION: u64 = 1;
const MAX_STRING_LENGTH: u64 = 256;

// ===== ERROR CODES =====

const EInvalidCap: u64 = 0;
const ENoAccess: u64 = 1;
const EUserBlacklisted: u64 = 2;
const ENotMember: u64 = 3;
const EInvalidVersion: u64 = 4;
const EDuplicate: u64 = 5;
const EStringTooLong: u64 = 6;
const ENotOwner: u64 = 7;

// ===== STRUCTS =====

public struct SUI_MAIL has drop {}

public struct VersionCap has key {
    id: object::UID,
    version: u64,
}

public struct UserProfile has key {
    id: object::UID,
    owner: address,
    blacklist_count: u64,
    created_at: u64,
}

public struct BlacklistEntry has copy, drop, store {
    blocked: bool,
    blocked_at: u64,
}

public struct Allowlist has key {
    id: object::UID,
    owner: address,
    name: String,
    description: String,
    member_count: u64,
    created_at: u64,
    updated_at: u64,
}

public struct MemberEntry has copy, drop, store {
    is_allowed: bool,
    added_at: u64,
    added_by: address,
}

public struct Cap has key, store {
    id: object::UID,
    allowlist_id: object::ID,
}

public struct Mail has key {
    id: object::UID,
    sender: address,
    subject: String,
    blob_id: String,
    allowlist_id: object::ID,
    timestamp: u64,
    reply_count: u64,
}

public struct ReplyEntry has copy, drop, store {
    mail_id: object::ID,
    sender: address,
    timestamp: u64,
}

// ===== EVENTS =====

public struct ProfileCreated has copy, drop {
    profile_id: object::ID,
    owner: address,
}

public struct UserBlacklisted has copy, drop {
    profile_id: object::ID,
    blocker: address,
    blocked_user: address,
}

public struct UserUnblacklisted has copy, drop {
    profile_id: object::ID,
    unblocker: address,
    unblocked_user: address,
}

public struct AllowlistCreated has copy, drop {
    allowlist_id: object::ID,
    owner: address,
    name: String,
}

public struct MemberAdded has copy, drop {
    allowlist_id: object::ID,
    member: address,
    added_by: address,
}

public struct MemberRemoved has copy, drop {
    allowlist_id: object::ID,
    member: address,
    removed_by: address,
}

public struct MailSent has copy, drop {
    mail_id: object::ID,
    sender: address,
    allowlist_id: object::ID,
    subject: String,
    timestamp: u64,
}

public struct MailReplied has copy, drop {
    parent_mail_id: object::ID,
    reply_mail_id: object::ID,
    sender: address,
    timestamp: u64,
}

public struct SealApproved has copy, drop {
    caller: address,
    allowlist_id: object::ID,
    blob_id: vector<u8>,
    timestamp: u64,
}

// ===== INITIALIZATION =====

fun init(otw: SUI_MAIL, ctx: &mut tx_context::TxContext) {
    let publisher = package::claim(otw, ctx);

    let version_cap = VersionCap {
        id: object::new(ctx),
        version: VERSION,
    };

    transfer::transfer(version_cap, tx_context::sender(ctx));
    transfer::public_transfer(publisher, tx_context::sender(ctx));
}

// ===== 1. USER PROFILE =====

public fun create_profile(ctx: &mut tx_context::TxContext): UserProfile {
    let profile = UserProfile {
        id: object::new(ctx),
        owner: tx_context::sender(ctx),
        blacklist_count: 0,
        created_at: tx_context::epoch(ctx),
    };

    event::emit(ProfileCreated {
        profile_id: object::id(&profile),
        owner: profile.owner,
    });

    profile
}

entry fun create_profile_entry(ctx: &mut tx_context::TxContext) {
    let profile = create_profile(ctx);
    transfer::share_object(profile);
}

public fun add_to_blacklist(
    profile: &mut UserProfile,
    blocked_user: address,
    ctx: &mut tx_context::TxContext,
) {
    assert!(profile.owner == tx_context::sender(ctx), ENotOwner);
    assert!(!df::exists_with_type<address, BlacklistEntry>(&profile.id, blocked_user), EDuplicate);

    df::add(
        &mut profile.id,
        blocked_user,
        BlacklistEntry {
            blocked: true,
            blocked_at: tx_context::epoch(ctx),
        },
    );

    profile.blacklist_count = profile.blacklist_count + 1;

    event::emit(UserBlacklisted {
        profile_id: object::id(profile),
        blocker: profile.owner,
        blocked_user,
    });
}

entry fun add_to_blacklist_entry(
    profile: &mut UserProfile,
    blocked_user: address,
    ctx: &mut tx_context::TxContext,
) {
    add_to_blacklist(profile, blocked_user, ctx);
}

public fun remove_from_blacklist(
    profile: &mut UserProfile,
    user: address,
    ctx: &tx_context::TxContext,
) {
    assert!(profile.owner == tx_context::sender(ctx), ENotOwner);

    if (df::exists_with_type<address, BlacklistEntry>(&profile.id, user)) {
        let _entry: BlacklistEntry = df::remove(&mut profile.id, user);
        profile.blacklist_count = profile.blacklist_count - 1;

        event::emit(UserUnblacklisted {
            profile_id: object::id(profile),
            unblocker: profile.owner,
            unblocked_user: user,
        });
    }
}

entry fun remove_from_blacklist_entry(
    profile: &mut UserProfile,
    user: address,
    ctx: &tx_context::TxContext,
) {
    remove_from_blacklist(profile, user, ctx);
}

public fun is_blacklisted(profile: &UserProfile, user: address): bool {
    df::exists_with_type<address, BlacklistEntry>(&profile.id, user)
}

// ===== 2. ALLOWLIST =====

public fun create_allowlist(
    name: String,
    description: String,
    ctx: &mut tx_context::TxContext,
): Cap {
    assert!(string::length(&name) <= MAX_STRING_LENGTH, EStringTooLong);
    assert!(string::length(&description) <= MAX_STRING_LENGTH, EStringTooLong);

    let allowlist = Allowlist {
        id: object::new(ctx),
        owner: tx_context::sender(ctx),
        name,
        description,
        member_count: 0,
        created_at: tx_context::epoch(ctx),
        updated_at: tx_context::epoch(ctx),
    };

    let allowlist_id = object::id(&allowlist);

    event::emit(AllowlistCreated {
        allowlist_id,
        owner: allowlist.owner,
        name: allowlist.name,
    });

    transfer::share_object(allowlist);

    Cap {
        id: object::new(ctx),
        allowlist_id,
    }
}

entry fun create_allowlist_entry(
    name: String,
    description: String,
    ctx: &mut tx_context::TxContext,
) {
    let cap = create_allowlist(name, description, ctx);
    transfer::transfer(cap, tx_context::sender(ctx));
}

public fun add_member(
    allowlist: &mut Allowlist,
    cap: &Cap,
    member: address,
    member_profile: &UserProfile,
    ctx: &tx_context::TxContext,
) {
    assert!(cap.allowlist_id == object::id(allowlist), EInvalidCap);

    let owner = allowlist.owner;
    assert!(!is_blacklisted(member_profile, owner), EUserBlacklisted);
    assert!(member_profile.owner == member, EInvalidCap);
    assert!(!df::exists_with_type<address, MemberEntry>(&allowlist.id, member), EDuplicate);

    df::add(
        &mut allowlist.id,
        member,
        MemberEntry {
            is_allowed: true,
            added_at: tx_context::epoch(ctx),
            added_by: owner,
        },
    );

    allowlist.member_count = allowlist.member_count + 1;
    allowlist.updated_at = tx_context::epoch(ctx);

    event::emit(MemberAdded {
        allowlist_id: object::id(allowlist),
        member,
        added_by: owner,
    });
}

entry fun add_member_entry(
    allowlist: &mut Allowlist,
    cap: &Cap,
    member: address,
    member_profile: &UserProfile,
    ctx: &tx_context::TxContext,
) {
    add_member(allowlist, cap, member, member_profile, ctx);
}

public fun remove_member(
    allowlist: &mut Allowlist,
    cap: &Cap,
    member: address,
    ctx: &tx_context::TxContext,
) {
    assert!(cap.allowlist_id == object::id(allowlist), EInvalidCap);

    if (df::exists_with_type<address, MemberEntry>(&allowlist.id, member)) {
        let _entry: MemberEntry = df::remove(&mut allowlist.id, member);
        allowlist.member_count = allowlist.member_count - 1;
        allowlist.updated_at = tx_context::epoch(ctx);

        event::emit(MemberRemoved {
            allowlist_id: object::id(allowlist),
            member,
            removed_by: allowlist.owner,
        });
    }
}

entry fun remove_member_entry(
    allowlist: &mut Allowlist,
    cap: &Cap,
    member: address,
    ctx: &tx_context::TxContext,
) {
    remove_member(allowlist, cap, member, ctx);
}

public fun is_member(allowlist: &Allowlist, user: address): bool {
    df::exists_with_type<address, MemberEntry>(&allowlist.id, user)
}

// Add member by address (no profile required)
public fun add_member_by_address(
    allowlist: &mut Allowlist,
    cap: &Cap,
    member: address,
    ctx: &tx_context::TxContext,
) {
    assert!(cap.allowlist_id == object::id(allowlist), EInvalidCap);
    assert!(!df::exists_with_type<address, MemberEntry>(&allowlist.id, member), EDuplicate);

    df::add(
        &mut allowlist.id,
        member,
        MemberEntry {
            is_allowed: true,
            added_at: tx_context::epoch(ctx),
            added_by: allowlist.owner,
        },
    );

    allowlist.member_count = allowlist.member_count + 1;
    allowlist.updated_at = tx_context::epoch(ctx);

    event::emit(MemberAdded {
        allowlist_id: object::id(allowlist),
        member,
        added_by: allowlist.owner,
    });
}

entry fun add_member_by_address_entry(
    allowlist: &mut Allowlist,
    cap: &Cap,
    member: address,
    ctx: &tx_context::TxContext,
) {
    add_member_by_address(allowlist, cap, member, ctx);
}

// ===== 3. MAIL =====

public fun create_mail(
    subject: String,
    blob_id: String,
    allowlist: &Allowlist,
    ctx: &mut tx_context::TxContext,
): Mail {
    let sender = tx_context::sender(ctx);

    assert!(string::length(&subject) <= MAX_STRING_LENGTH, EStringTooLong);
    assert!(string::length(&blob_id) <= MAX_STRING_LENGTH, EStringTooLong);
    assert!(is_member(allowlist, sender), ENotMember);

    let mail = Mail {
        id: object::new(ctx),
        sender,
        subject,
        blob_id,
        allowlist_id: object::id(allowlist),
        timestamp: tx_context::epoch(ctx),
        reply_count: 0,
    };

    event::emit(MailSent {
        mail_id: object::id(&mail),
        sender,
        allowlist_id: object::id(allowlist),
        subject: mail.subject,
        timestamp: mail.timestamp,
    });

    mail
}

entry fun create_mail_entry(
    subject: String,
    blob_id: String,
    allowlist: &Allowlist,
    ctx: &mut tx_context::TxContext,
) {
    let mail = create_mail(subject, blob_id, allowlist, ctx);
    transfer::share_object(mail);
}

public fun add_reply(parent_mail: &mut Mail, reply_mail: &Mail, ctx: &tx_context::TxContext) {
    assert!(parent_mail.allowlist_id == reply_mail.allowlist_id, EInvalidCap);

    let sender = tx_context::sender(ctx);
    let reply_id = object::id(reply_mail);

    assert!(!df::exists_with_type<object::ID, ReplyEntry>(&parent_mail.id, reply_id), EDuplicate);

    df::add(
        &mut parent_mail.id,
        reply_id,
        ReplyEntry {
            mail_id: reply_id,
            sender,
            timestamp: tx_context::epoch(ctx),
        },
    );

    parent_mail.reply_count = parent_mail.reply_count + 1;

    event::emit(MailReplied {
        parent_mail_id: object::id(parent_mail),
        reply_mail_id: reply_id,
        sender,
        timestamp: tx_context::epoch(ctx),
    });
}

entry fun add_reply_entry(parent_mail: &mut Mail, reply_mail: &Mail, ctx: &tx_context::TxContext) {
    add_reply(parent_mail, reply_mail, ctx);
}

// ===== 4. SEAL IBE =====

public fun namespace(allowlist: &Allowlist): vector<u8> {
    object::id_to_bytes(&object::id(allowlist))
}

fun is_prefix(namespace: vector<u8>, id: vector<u8>): bool {
    let namespace_len = vector::length(&namespace);
    if (vector::length(&id) < namespace_len) {
        return false
    };

    let mut i = 0;
    while (i < namespace_len) {
        if (*vector::borrow(&namespace, i) != *vector::borrow(&id, i)) {
            return false
        };
        i = i + 1;
    };

    true
}

fun approve_internal(caller: address, id: vector<u8>, allowlist: &Allowlist): bool {
    let ns = namespace(allowlist);
    if (!is_prefix(ns, id)) {
        return false
    };

    is_member(allowlist, caller)
}

entry fun seal_approve(id: vector<u8>, allowlist: &Allowlist, ctx: &tx_context::TxContext) {
    let caller = tx_context::sender(ctx);
    assert!(approve_internal(caller, id, allowlist), ENoAccess);

    event::emit(SealApproved {
        caller,
        allowlist_id: object::id(allowlist),
        blob_id: id,
        timestamp: tx_context::epoch(ctx),
    });
}

// ===== 5. GETTERS =====

public fun get_profile_owner(profile: &UserProfile): address {
    profile.owner
}

public fun get_profile_blacklist_count(profile: &UserProfile): u64 {
    profile.blacklist_count
}

public fun get_allowlist_owner(allowlist: &Allowlist): address {
    allowlist.owner
}

public fun get_allowlist_name(allowlist: &Allowlist): String {
    allowlist.name
}

public fun get_allowlist_member_count(allowlist: &Allowlist): u64 {
    allowlist.member_count
}

public fun get_mail_sender(mail: &Mail): address {
    mail.sender
}

public fun get_mail_subject(mail: &Mail): String {
    mail.subject
}

public fun get_mail_blob_id(mail: &Mail): String {
    mail.blob_id
}

public fun get_mail_allowlist_id(mail: &Mail): object::ID {
    mail.allowlist_id
}

public fun get_mail_reply_count(mail: &Mail): u64 {
    mail.reply_count
}

public fun get_mail_timestamp(mail: &Mail): u64 {
    mail.timestamp
}

// ===== 6. ADMIN =====

public fun get_version(cap: &VersionCap): u64 {
    cap.version
}

public fun migrate_to_v2(_version_cap: &VersionCap, _ctx: &tx_context::TxContext) {
    abort EInvalidVersion
}

// ===== 7. TEST HELPERS =====

#[test_only]
public fun new_profile_for_testing(ctx: &mut tx_context::TxContext): UserProfile {
    UserProfile {
        id: object::new(ctx),
        owner: tx_context::sender(ctx),
        blacklist_count: 0,
        created_at: 0,
    }
}

#[test_only]
public fun new_allowlist_for_testing(ctx: &mut tx_context::TxContext): Allowlist {
    Allowlist {
        id: object::new(ctx),
        owner: tx_context::sender(ctx),
        name: string::utf8(b"Test"),
        description: string::utf8(b"Test"),
        member_count: 0,
        created_at: 0,
        updated_at: 0,
    }
}

#[test_only]
public fun new_cap_for_testing(allowlist_id: object::ID, ctx: &mut tx_context::TxContext): Cap {
    Cap {
        id: object::new(ctx),
        allowlist_id,
    }
}

#[test_only]
public fun destroy_profile_for_testing(profile: UserProfile) {
    let UserProfile { id, owner: _, blacklist_count: _, created_at: _ } = profile;
    object::delete(id);
}

#[test_only]
public fun destroy_allowlist_for_testing(allowlist: Allowlist) {
    let Allowlist {
        id,
        owner: _,
        name: _,
        description: _,
        member_count: _,
        created_at: _,
        updated_at: _,
    } = allowlist;
    object::delete(id);
}

#[test_only]
public fun destroy_cap_for_testing(cap: Cap) {
    let Cap { id, allowlist_id: _ } = cap;
    object::delete(id);
}

#[test_only]
public fun destroy_mail_for_testing(mail: Mail) {
    let Mail {
        id,
        sender: _,
        subject: _,
        blob_id: _,
        allowlist_id: _,
        timestamp: _,
        reply_count: _,
    } = mail;
    object::delete(id);
}
