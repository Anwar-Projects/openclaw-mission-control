# 📚 AGENT DOCUMENTATION LEARNING TASKS

**Date:** 2026-02-16  
**Status:** ASSIGNED - ACTIVE  
**Rule:** All bots MUST read, summarize, and discuss docs in Squad Chat regularly

---

## 🎯 LEADER BOT
**Task ID:** DOC-LEADER-001  
**Status:** ACTIVE  
**Priority:** P2  

**Learning Sources:**
- Mission Control Dashboard Architecture
- Agent coordination patterns
- Task delegation workflows
- Approval processes

**Deliverables:**
1. Daily summary to Squad Chat on fleet coordination best practices
2. Weekly report on agent performance optimization
3. Propose improvements to task routing

---

## 🖥️ PROXMOX AGENT
**Task ID:** DOC-PROXMOX-001  
**Status:** ACTIVE  
**Priority:** P2  

**Learning Sources:**
- [Proxmox VE Documentation](https://pve.proxmox.com/pve-docs/)
- [Proxmox Admin Guide](https://pve.proxmox.com/pve-docs/pve-admin-guide.html)
- PBS (Proxmox Backup Server) docs
- vzdump/vzrestore documentation
- ZFS on Linux documentation
- QEMU/KVM best practices

**Deliverables:**
1. Daily summary to Squad Chat (e.g., "Today learned about vzdump --exclude-path...")
2. Apply learnings to optimize weekly backup jobs (Sun 01:00)
3. Propose VM/CT optimizations to Leader
4. Create 1-page cheat sheet for most-used commands

---

## 🏠 HOME AGENT
**Task ID:** DOC-HOME-001  
**Status:** ACTIVE  
**Priority:** P2  

**Learning Sources:**
- Home Assistant Core Documentation
- Home Assistant REST API docs
- MQTT integration guide
- Zigbee2MQTT documentation (if applicable)
- ESPHome documentation
- Node-RED integration (if configured)

**Deliverables:**
1. Daily summary to Squad Chat on automation patterns
2. Identify 1 new automation opportunity per week
3. Document common device troubleshoot patterns
4. Propose energy-saving automations

---

## 💾 STORAGE AGENT
**Task ID:** DOC-STORAGE-001  
**Status:** ACTIVE  
**Priority:** P1  

**Learning Sources:**
- TrueNAS SCALE Documentation
- TrueNAS Core Documentation
- ZFS Documentation (OpenZFS)
- PBS (Proxmox Backup Server) restore procedures
- zfs/zpool command reference
- NFS/SMB best practices
- Snapshot management strategies

**Deliverables:**
1. Daily summary to Squad Chat (e.g., "Today learned about zpool scrub...")
2. **URGENT:** Document current backup status from daily 02:00 jobs
3. Create TrueNAS dataset organization recommendations
4. Propose retention policy optimizations
5. Weekly scrub status report with findings

**Current Infrastructure:**
- TrueNAS VM 114 (192.168.30.120, VLAN STORAGE)
- Daily backups: CTs 121, 122, 131 → TRUENAS
- Weekly: VM 114 (TrueNAS) → stop-mode backup Sunday 03:00

---

## 🌐 NETWORK AGENT
**Task ID:** DOC-NETWORK-001  
**Status:** ACTIVE  
**Priority:** P2  

**Learning Sources:**
- Firewalla Documentation
- UniFi UCG Fiber Gateway docs
- VLAN segmentation best practices
- DNS/DHCP configuration
- WireGuard/OpenVPN documentation
- Network troubleshooting guides

**Deliverables:**
1. Daily summary to Squad Chat on network security patterns
2. Create network topology map updates
3. Document VLAN-to-device assignments
4. Propose security hardening recommendations
5. Weekly connectivity health report

**Current Infrastructure:**
- Firewalla: Gateway/Router/DHCP
- UniFi UCG Fiber: Controller only
- 6 VLANs: MGMT(10), HOME(20), STORAGE(30), LAB(40), KIDS(50), IoT(60)

---

## 🔐 SECURITY AGENT
**Task ID:** DOC-SECURITY-001  
**Status:** ACTIVE  
**Priority:** P0  

**Learning Sources:**
- Wazuh Documentation
- fail2ban documentation
- Intrusion detection guides
- Vulnerability scanning methodologies
- SSL/TLS certificate management
- Security audit frameworks

**Deliverables:**
1. Daily summary to Squad Chat on security findings
2. **URGENT:** Complete security posture baseline
3. Weekly threat intelligence update
4. Monthly vulnerability scan results
5. Propose security policy improvements

**Critical Focus:**
- Review all 6 VLANs for segmentation gaps
- Certificate expiry monitoring
- Failed login attempt analysis
- Network access anomaly detection

---

## 📝 DISCUSSION REQUIREMENTS

**Daily (MANDATORY):** Each agent post 1 learning insight to Squad Chat  
**Format:**
```
[AGENT] Today's Learning:
📚 Source: [doc/link]
💡 Key Insight: [summary]
🎯 Application: [how to apply in homelab]
```

**Weekly Review (Sundays):**
- Leader aggregates all learnings
- Propose tasks based on new knowledge
- Update agent skills registry

---

## ✅ EXECUTION STATUS

| Agent | Task ID | Status | Started |
|-------|---------|--------|---------|
| Leader | DOC-LEADER-001 | ACTIVE | 2026-02-16 17:00 |
| Proxmox | DOC-PROXMOX-001 | ACTIVE | 2026-02-16 17:00 |
| Home | DOC-HOME-001 | ACTIVE | 2026-02-16 17:00 |
| Storage | DOC-STORAGE-001 | ACTIVE (P1) | 2026-02-16 17:00 |
| Network | DOC-NETWORK-001 | ACTIVE | 2026-02-16 17:00 |
| Security | DOC-SECURITY-001 | ACTIVE (P0) | 2026-02-16 17:00 |

---

*Next status update: T+3 minutes (17:03)*
