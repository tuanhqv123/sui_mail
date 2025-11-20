# SECURE MAIL - IMPLEMENTATION PLAN

## I. PROJECT OVERVIEW

### Vision

A decentralized, end-to-end encrypted email system on Sui blockchain with:

- User-controlled privacy through blacklists
- Allowlist-based access control
- Seal IBE encryption integration
- Reply threading support
- Production-ready security

### Tech Stack

- **Blockchain**: Sui Network (Move language)
- **Encryption**: Walrus + Seal IBE
- **Frontend**: React + TypeScript
- **Storage**: Walrus for encrypted blobs

---

## II. SMART CONTRACT ARCHITECTURE

### A. Core Modules

#### 1. **mail.move** (Main Module)

- User Profile Management
- Blacklist System
- Allowlist Management
- Mail Creation & Threading
- Seal IBE Integration

#### 2. **mail_v2.move** (Upgrade Module)

- Migration path from V1
- Extended features (expiration, etc.)
- Backward compatibility

### B. Data Structures

```
UserProfile
├── id: UID
├── owner: address
├── display_name: String
├── email: String
├── blacklist_count: u64
├── created_at: u64
└── dynamic_fields: {address -> BlacklistEntry}

Allowlist
├── id: UID
├── owner: address
├── name: String
├── description: String
├── member_count: u64
├── created_at: u64
├── updated_at: u64
└── dynamic_fields: {address -> MemberEntry}

Mail
├── id: UID
├── sender: address
├── subject: String
├── blob_id: String (Walrus reference)
├── allowlist_id: ID
├── timestamp: u64
├── reply_count: u64
└── dynamic_fields: {mail_id -> ReplyEntry}

Cap (Allowlist Control)
├── id: UID
└── allowlist_id: ID
```

---

## III. IMPLEMENTATION PHASES

### Phase 1: Core Smart Contract (Week 1-2)

**Deliverables:**

- [x] Module structure setup
- [ ] User Profile functions
- [ ] Blacklist system
- [ ] Allowlist management
- [ ] Cap-based access control
- [ ] Event emission

**Acceptance Criteria:**

- All functions compile without errors
- Error codes properly defined
- Events emit correctly
- Access control enforced

### Phase 2: Mail & Threading (Week 2-3)

**Deliverables:**

- [ ] Mail creation with allowlist check
- [ ] Reply threading system
- [ ] Dynamic field management
- [ ] Seal IBE integration
- [ ] Namespace approval logic

**Acceptance Criteria:**

- Mail can be created and stored
- Replies properly linked
- Only allowlist members can access
- Seal approve function works

### Phase 3: Testing Suite (Week 3-4)

**Deliverables:**

- [ ] Unit tests for all functions
- [ ] Integration tests
- [ ] Security tests (bypass attempts)
- [ ] Edge case coverage
- [ ] Gas optimization tests

**Acceptance Criteria:**

- 100% function coverage
- All security tests pass
- Gas costs within acceptable range
- No panic/abort in normal flow

### Phase 4: Upgrade & Migration (Week 4)

**Deliverables:**

- [ ] Version control system
- [ ] V2 module with new features
- [ ] Migration functions
- [ ] Backward compatibility tests

**Acceptance Criteria:**

- Smooth migration from V1 to V2
- No data loss
- Old contracts still functional

---

## IV. TESTING STRATEGY

### A. Unit Tests

#### 1. User Profile Tests

```
test_create_profile()
test_add_to_blacklist()
test_remove_from_blacklist()
test_is_blacklisted()
test_duplicate_blacklist_prevention()
```

#### 2. Allowlist Tests

```
test_create_allowlist()
test_add_member()
test_add_member_fails_when_blacklisted()
test_remove_member()
test_is_member()
test_invalid_cap_rejection()
test_duplicate_member_prevention()
```

#### 3. Mail Tests

```
test_create_mail()
test_create_mail_fails_non_member()
test_add_reply()
test_reply_count_increment()
test_reply_different_allowlist_fails()
```

#### 4. Seal IBE Tests

```
test_seal_approve()
test_seal_approve_non_member_fails()
test_namespace_generation()
test_is_prefix()
```

### B. Integration Tests

#### Scenario 1: Alice sends mail to Bob

```
1. Create Alice's profile
2. Create Bob's profile
3. Alice creates allowlist
4. Alice adds Bob to allowlist
5. Alice creates mail
6. Bob calls seal_approve (success)
7. Charlie calls seal_approve (fails)
```

#### Scenario 2: Bob blocks Alice

```
1. Bob adds Alice to blacklist
2. Alice tries to add Bob to allowlist
3. Transaction aborts with EUserBlacklisted
4. Frontend prevents this before transaction
```

#### Scenario 3: Reply threading

```
1. Alice creates mail in allowlist
2. Bob replies to Alice's mail
3. Charlie replies to Bob's reply
4. Verify reply_count increments
5. Verify dynamic fields store replies
```

### C. Security Tests

```
test_bypass_blacklist_fails()
test_non_owner_cannot_modify_allowlist()
test_invalid_cap_rejected()
test_replay_attack_prevention()
test_access_control_enforcement()
```

### D. Gas Optimization Tests

```
test_gas_create_profile()
test_gas_create_allowlist()
test_gas_add_member()
test_gas_create_mail()
test_gas_seal_approve()
```

**Target Gas Costs:**

- create_profile: < 1M gas
- create_allowlist: < 2M gas
- add_member: < 1.5M gas
- create_mail: < 3M gas
- seal_approve: < 0.5M gas

---

## V. SECURITY CHECKLIST

### A. Access Control

- [ ] Only profile owner can modify blacklist
- [ ] Only cap holder can modify allowlist
- [ ] Only allowlist members can create mail
- [ ] Only allowlist members can approve seal
- [ ] Blacklist check enforced on-chain

### B. Input Validation

- [ ] Address validation
- [ ] String length limits
- [ ] Duplicate prevention
- [ ] ID matching verification
- [ ] Timestamp validation

### C. Error Handling

- [ ] All errors have unique codes
- [ ] Clear error messages
- [ ] No panic in production paths
- [ ] Graceful degradation

### D. Data Integrity

- [ ] No orphaned objects
- [ ] Proper cleanup on delete
- [ ] Counter accuracy (member_count, reply_count)
- [ ] Event emission consistency

### E. Upgrade Safety

- [ ] Version control implemented
- [ ] Migration path tested
- [ ] Backward compatibility verified
- [ ] No breaking changes in storage

---

## VI. DEPLOYMENT PLAN

### A. Testnet Deployment

1. **Setup**

   - Configure Sui CLI
   - Create deployment account
   - Fund with testnet SUI

2. **Build**

   ```bash
   sui move build
   sui move test
   ```

3. **Deploy**

   ```bash
   sui client publish --gas-budget 100000000
   ```

4. **Verify**
   - Check package ID
   - Verify module published
   - Test basic functions

### B. Mainnet Deployment

1. **Pre-flight**

   - [ ] All tests pass
   - [ ] Security audit complete
   - [ ] Gas optimization done
   - [ ] Documentation ready

2. **Deploy**

   - Use multi-sig wallet
   - Set gas budget appropriately
   - Verify immediately after

3. **Post-deployment**
   - [ ] Update frontend with package ID
   - [ ] Announce to users
   - [ ] Monitor events
   - [ ] Setup alerts

---

## VII. MONITORING & MAINTENANCE

### A. Metrics to Track

- Total profiles created
- Total allowlists created
- Total mails sent
- Gas costs trending
- Error rate by function
- Blacklist usage stats

### B. Alerts

- Unusual gas spikes
- High error rates
- Failed transactions
- Potential attacks

### C. Upgrade Triggers

- Security vulnerabilities discovered
- Feature requests from users
- Gas optimization opportunities
- Bug fixes needed

---

## VIII. DOCUMENTATION REQUIREMENTS

### A. Developer Docs

- [ ] Function reference
- [ ] Module architecture
- [ ] Data structure details
- [ ] Event specifications
- [ ] Integration guide

### B. User Docs

- [ ] How to create profile
- [ ] How to manage blacklist
- [ ] How to send mail
- [ ] How to reply
- [ ] Privacy best practices

### C. API Docs

- [ ] RPC endpoints
- [ ] Event indexing
- [ ] Query patterns
- [ ] Frontend integration

---

## IX. SUCCESS CRITERIA

### Technical

- ✅ All tests pass (100% coverage)
- ✅ No critical security issues
- ✅ Gas costs optimized
- ✅ Upgradable architecture

### Functional

- ✅ Users can create profiles
- ✅ Blacklist prevents unwanted contacts
- ✅ Mail is encrypted end-to-end
- ✅ Only allowlist members can decrypt
- ✅ Reply threading works

### Performance

- ✅ < 5 second transaction confirmation
- ✅ < 10M gas for typical mail send
- ✅ Scales to 1000+ members per allowlist
- ✅ No bottlenecks in high load

---

## X. RISK MITIGATION

### Technical Risks

| Risk                        | Probability | Impact   | Mitigation               |
| --------------------------- | ----------- | -------- | ------------------------ |
| Smart contract bug          | Medium      | Critical | Extensive testing, audit |
| Gas costs too high          | Low         | High     | Optimization, batching   |
| Seal IBE integration issues | Medium      | High     | Early testing, fallback  |
| Upgrade breaks data         | Low         | Critical | Migration tests, backup  |

### Operational Risks

| Risk               | Probability | Impact   | Mitigation              |
| ------------------ | ----------- | -------- | ----------------------- |
| Key compromise     | Low         | Critical | Multi-sig, cold storage |
| Walrus downtime    | Medium      | High     | Caching, retry logic    |
| Network congestion | High        | Medium   | Gas price adjustment    |

---

## XI. NEXT STEPS (Immediate)

1. **Review this plan** with team
2. **Setup development environment**
   - Install Sui CLI
   - Configure testnet
3. **Implement Phase 1** functions
4. **Write unit tests** alongside code
5. **Deploy to testnet** for integration testing
6. **Iterate** based on testing results

---

## XII. RESOURCES

### Documentation

- [Sui Move Book](https://move-book.com/)
- [Sui Documentation](https://docs.sui.io/)
- [Dynamic Fields Guide](https://docs.sui.io/concepts/dynamic-fields)
- [Seal IBE](https://github.com/MystenLabs/seal)

### Tools

- Sui CLI
- Move Analyzer (VS Code)
- Sui Explorer
- Walrus CLI

### Community

- Sui Discord
- Move Forum
- GitHub Issues

---

**Last Updated:** 2025-11-21  
**Version:** 1.0  
**Status:** Ready for Implementation
