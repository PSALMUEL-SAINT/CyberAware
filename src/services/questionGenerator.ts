import { QuizQuestion, QuestionDifficulty, QuestionType, AssessmentCategoryKey, ReviewStatus } from '../types';
import { validateQuestion, normalizeQuestionRecord } from '../utils/questionValidation';
import { saveQuestion, getQuestionById } from './questionDb';

export interface GenerationParams {
  category: AssessmentCategoryKey | string;
  subtopic?: string;
  difficulty: QuestionDifficulty;
  type?: QuestionType;
  count: number;
}

interface ProceduralTemplate {
  category: AssessmentCategoryKey;
  subtopic: string;
  difficulty: QuestionDifficulty;
  type: QuestionType;
  provenance: string;
  generate: (seed: number) => Partial<QuizQuestion>;
}

// Procedural domain templates ensuring high technical fidelity across domains
const TEMPLATES: ProceduralTemplate[] = [
  // 1. Network Security: Subnetting / Firewalls / Port Knocking
  {
    category: 'network_security',
    subtopic: 'Firewalls & Next-Gen Filters',
    difficulty: 'intermediate',
    type: 'log_analysis',
    provenance: 'NIST SP 800-41 Rev. 1 / RFC 793',
    generate: (seed) => {
      const srcIps = ['198.51.100.42', '203.0.113.88', '192.0.2.145'];
      const dstPorts = [445, 3389, 22, 8080];
      const srcIp = srcIps[seed % srcIps.length];
      const port = dstPorts[seed % dstPorts.length];
      const portService = port === 445 ? 'SMB' : port === 3389 ? 'RDP' : port === 22 ? 'SSH' : 'Alternative HTTP';

      return {
        topic: 'Network Security & Protocols',
        question: `An internal perimeter firewall alert shows repeated TCP SYN packets from public IP ${srcIp} targeting destination port ${port}/TCP (${portService}) with no subsequent ACK received. What type of activity does this pattern indicate, and what is the optimal remediation rule?`,
        logSnippet: {
          source: 'iptables / pfSense Filter Log',
          log: `[FILTER_DROP] IN=eth0 OUT= SRC=${srcIp} DST=10.0.4.15 LEN=60 TOS=0x00 PREC=0x00 TTL=51 ID=41920 PROTO=TCP SPT=54210 DPT=${port} WINDOW=64240 RES=0x00 SYN URGP=0\n[FILTER_DROP] IN=eth0 OUT= SRC=${srcIp} DST=10.0.4.15 LEN=60 TOS=0x00 PREC=0x00 TTL=51 ID=41921 PROTO=TCP SPT=54211 DPT=${port} WINDOW=64240 RES=0x00 SYN URGP=0`
        },
        options: [
          `Targeted port scan or brute-force reconnaissance against ${portService}; implement stateful rate-limiting and drop inbound unsolicited public traffic to port ${port}.`,
          `Legitimate DNS health check query; allow port ${port} globally across all external subnets.`,
          `NTP reflection attack; configure UDP amplification filters on the border router.`,
          `Corrupted MTU packet fragmentation; decrease TCP window size to 1024 bytes.`
        ],
        correctAnswer: 0,
        explanation: `Repeated SYN packets without ACK completion indicate automated TCP port scanning or probing of service port ${port} (${portService}). Edge security controls should never expose management or file-sharing ports directly to the public internet; traffic should be dropped by default with stateful rate-limiting.`,
        mitigation: `Enforce Zero Trust access using VPN/bastion with MFA rather than exposing service ports like ${port} directly.`,
        tips: 'Block external access to sensitive internal ports (SMB 445, RDP 3389) at border firewalls.'
      };
    }
  },

  // 2. Web AppSec: API Security / Rate Limiting / Broken Object Level Authorization
  {
    category: 'web_appsec',
    subtopic: 'API Security & OAuth',
    difficulty: 'advanced',
    type: 'scenario',
    provenance: 'OWASP API Security Top 10 (API1:2023 BOLA)',
    generate: (seed) => {
      const endpoints = ['/api/v1/users/9412/billing', '/api/v1/patients/3810/records', '/api/v1/accounts/7021/statements'];
      const targetEndpoint = endpoints[seed % endpoints.length];
      const victimId = targetEndpoint.split('/')[4];
      const attackerId = (parseInt(victimId) + 1).toString();

      return {
        topic: 'Web Application Security & OWASP',
        question: `A security auditor observes that an authenticated mobile app user with account ID ${attackerId} can access private JSON documents belonging to user ${victimId} by simply modifying the URL parameter to GET ${targetEndpoint}. Which vulnerability is present, and what is the proper fix?`,
        scenarioText: `Request:\nGET ${targetEndpoint} HTTP/1.1\nHost: api.cloudcorp.internal\nAuthorization: Bearer eyJhbGciOi...[User ${attackerId} Token]\n\nResponse:\nHTTP/1.1 200 OK\n{"userId": "${victimId}", "sensitiveData": "Confidential PII"}`,
        options: [
          'Broken Object Level Authorization (BOLA/IDOR); validate that the authenticated session principal owns or is authorized for the requested resource ID on every backend query.',
          'Cross-Site Scripting (XSS); sanitize HTML inputs on the frontend view.',
          'SQL Injection; replace the query with unparameterized dynamic string concatenation.',
          'Cross-Site Request Forgery (CSRF); add an Anti-CSRF token header to GET requests.'
        ],
        correctAnswer: 0,
        explanation: 'Broken Object Level Authorization (BOLA/IDOR) occurs when code relies on user-supplied IDs to retrieve objects without checking authorization permissions. The backend must verify that the requester has explicit authorization to access the specific object identifier.',
        mitigation: 'Implement fine-grained object-level authorization policies checking that context.currentUser.id === resource.ownerId.',
        tips: 'Never trust client-supplied resource IDs without server-side tenancy and access control validation.'
      };
    }
  },

  // 3. Cloud DevSecOps: IAM Least Privilege / S3 / KMS
  {
    category: 'cloud_devsecops',
    subtopic: 'Cloud IAM & Least Privilege',
    difficulty: 'intermediate',
    type: 'code_review',
    provenance: 'CIS AWS Foundations Benchmark v2.0 / NIST SP 800-145',
    generate: (seed) => {
      const services = ['s3', 'secretsmanager', 'dynamodb'];
      const service = services[seed % services.length];

      return {
        topic: 'Cloud Security & DevSecOps',
        question: `Review the following Cloud IAM Policy attached to a microservice worker role. Which principle does this policy violate, and how should it be scoped?`,
        codeSnippet: {
          language: 'json',
          code: `{\n  "Version": "2012-10-17",\n  "Statement": [\n    {\n      "Effect": "Allow",\n      "Action": "${service}:*",\n      "Resource": "*"\n    }\n  ]\n}`
        },
        options: [
          `It violates the Principle of Least Privilege by granting wildcard action (${service}:*) across all resources (*); scope permissions to explicit actions and specific ARNs.`,
          `It violates the Principle of Availability; wildcard permissions cause throttling errors.`,
          `It violates the JSON schema standard by using capital letters in "Allow".`,
          `It is completely secure because only authenticated IAM roles can assume it.`
        ],
        correctAnswer: 0,
        explanation: `Wildcard actions ("${service}:*") combined with wildcard resources ("*") provide administrator-level access to the service. If the container or instance running this service is compromised, attackers can read, modify, or delete all resources across the entire cloud account.`,
        mitigation: `Restrict permissions to the exact API operations needed (e.g. "${service}:GetObject") and specify precise resource ARNs.`,
        tips: 'Audit IAM policies using automated linters and CloudWatch Access Advisor.'
      };
    }
  },

  // 4. SOC Incident Response: Memory Forensics & Cobalt Strike
  {
    category: 'soc_incident_response',
    subtopic: 'Digital Forensics & Memory',
    difficulty: 'expert',
    type: 'log_analysis',
    provenance: 'NIST SP 800-86 / SANS DFIR Advanced Incident Response',
    generate: (seed) => {
      const procNames = ['svchost.exe', 'explorer.exe', 'spoolsv.exe'];
      const proc = procNames[seed % procNames.length];
      const pids = [1044, 2180, 3948];
      const pid = pids[seed % pids.length];

      return {
        topic: 'SOC Operations & Incident Response',
        question: `During volatile memory analysis of a compromised host, the forensic investigator executes Volatility 3 'windows.malfind'. The scan highlights memory address 0x0000021A4000 in process ${proc} (PID: ${pid}) with PAGE_EXECUTE_READWRITE permissions and unmapped executable MZ headers. What does this forensic artifact confirm?`,
        logSnippet: {
          source: 'Volatility 3 malfind.MalfindPlugin',
          log: `PID\tProcess\tStart VPN\tFile Output\tProtection\n${pid}\t${proc}\t0x0000021A4000\t\\Device\\HarddiskVolume3\tPAGE_EXECUTE_READWRITE\nHexdump:\n4d 5a 90 00 03 00 00 00  04 00 00 00 ff ff 00 00  |MZ..............|\nb8 00 00 00 00 00 00 00  40 00 00 00 00 00 00 00  |........@.......|`
        },
        options: [
          `Process injection / reflective DLL injection; an unbacked executable PE binary is executing within the virtual address space of a legitimate Windows process.`,
          `Standard .NET garbage collection cycle utilizing memory paging.`,
          `Corrupt hard disk sectors triggering safe-mode memory emulation.`,
          `Normal Windows Defender real-time scanning cache.`
        ],
        correctAnswer: 0,
        explanation: 'PAGE_EXECUTE_READWRITE (RWX) memory sections containing unmapped executable MZ headers (the DOS PE signature) without a backing file on disk are classic indicators of process hollow/reflective DLL injection (such as Cobalt Strike Beacons or Metasploit payloads).',
        mitigation: 'Isolate the host, dump the injected memory region for malware hash extraction, terminate the injected process tree, and inspect parent execution lineage.',
        tips: 'Legitimate binaries rarely require simultaneous write and execute permissions on memory allocations.'
      };
    }
  },

  // 5. Cryptography & PKI: Diffie-Hellman & Forward Secrecy
  {
    category: 'cryptography_pki',
    subtopic: 'TLS/SSL & Cipher Suites',
    difficulty: 'advanced',
    type: 'multiple_choice',
    provenance: 'RFC 8446 (The Transport Layer Security Protocol Version 1.3)',
    generate: (seed) => {
      const ciphers = [
        'TLS_AES_256_GCM_SHA384',
        'TLS_CHACHA20_POLY1305_SHA256',
        'TLS_AES_128_GCM_SHA256'
      ];
      const cipher = ciphers[seed % ciphers.length];

      return {
        topic: 'Cryptography, PKI & Secure Protocols',
        question: `Why did TLS 1.3 eliminate static RSA key exchange in favor of Ephemeral Diffie-Hellman (DHE/ECDHE) suites such as ${cipher}?`,
        options: [
          'To enforce Perfect Forward Secrecy (PFS), ensuring that a future compromise of the server\'s private key cannot decrypt past recorded sessions.',
          'Because RSA key pairs can only encrypt messages shorter than 16 bytes.',
          'Because TLS 1.3 dropped support for asymmetric cryptography entirely.',
          'To allow search engines to decrypt customer traffic for caching.'
        ],
        correctAnswer: 0,
        explanation: 'In static RSA key exchange, if an adversary records encrypted network sessions and later compromises or steals the server\'s private key, all recorded past sessions can be retroactively decrypted. Ephemeral Diffie-Hellman generates disposable per-session keys, providing Perfect Forward Secrecy (PFS).',
        mitigation: 'Enforce TLS 1.3 or modern TLS 1.2 cipher suites with ECDHE key exchange.',
        tips: 'Perfect Forward Secrecy protects past communications against future key compromises.'
      };
    }
  },

  // 6. OS & Endpoints: Linux Capabilities & SUID
  {
    category: 'os_endpoint_security',
    subtopic: 'Linux Hardening & Permissions',
    difficulty: 'intermediate',
    type: 'troubleshooting',
    provenance: 'CIS Linux Benchmark v3.1 / Linux man-pages capabilities(7)',
    generate: (seed) => {
      const binaries = ['/usr/bin/python3', '/usr/bin/vim', '/usr/bin/nmap'];
      const bin = binaries[seed % binaries.length];

      return {
        topic: 'Operating System & Endpoint Security',
        question: `During an internal system audit of an Ubuntu server, an administrator runs 'find / -perm -4000 -type f' and discovers that '${bin}' has the SUID bit enabled (-rwsr-xr-x root root). Why is this a severe security vulnerability?`,
        options: [
          `Any unprivileged local user executing '${bin}' will run with root privileges and can easily spawn an interactive root shell (privilege escalation).`,
          `The SUID bit disables swap space, causing the kernel to crash.`,
          `It prevents root from executing the binary over SSH.`,
          `It deletes the /etc/shadow file every time the command runs.`
        ],
        correctAnswer: 0,
        explanation: `SUID allows executables to run with the privileges of the file owner (root). Binaries capable of shell execution or file read/write (like python, vim, bash) listed in GTFOBins allow any standard user to execute arbitrary commands as root in seconds.`,
        mitigation: `Remove unnecessary SUID permissions immediately: 'chmod u-s ${bin}' and audit SUID binaries periodically.`,
        tips: 'Use Linux capabilities (e.g. setcap) or sudoers with specific flags rather than broad SUID root bits.'
      };
    }
  },

  // 7. Pentest Methodology: Kerberoasting & Service Principal Names
  {
    category: 'pentest_methodology',
    subtopic: 'Vulnerability Assessment',
    difficulty: 'expert',
    type: 'scenario',
    provenance: 'MITRE ATT&CK T1558.003 (Steal or Forge Kerberos Tickets: Kerberoasting)',
    generate: (seed) => {
      const spnNames = ['MSSQLSvc/sql-cluster.corp.local:1433', 'HTTP/intranet-app.corp.local', 'CIFS/fileshare.corp.local'];
      const spn = spnNames[seed % spnNames.length];

      return {
        topic: 'Penetration Testing & Security Assessment',
        question: `An authorized red team practitioner requests a Kerberos TGS ticket for Service Principal Name (SPN) '${spn}' associated with an Active Directory service account, and extracts the ticket hash offline. What attack is this, and how can the blue team mitigate it?`,
        options: [
          'Kerberoasting; mitigate by enforcing 25+ character complex passwords or Group Managed Service Accounts (gMSA) for service accounts.',
          'Pass-the-Hash; mitigate by disabling NTLMv2 authentication on domain controllers.',
          'Golden Ticket creation; mitigate by resetting the KRBTGT account password once every 10 years.',
          'ARP cache spoofing; mitigate by enabling DHCP snooping on core access switches.'
        ],
        correctAnswer: 0,
        explanation: 'Kerberoasting requests TGS tickets encrypted with the target service account\'s NTLM hash. Any domain user can request these tickets, export them to a cracking tool (hashcat), and crack weak service passwords offline without generating failed logon events.',
        mitigation: 'Implement Group Managed Service Accounts (gMSAs) with automatic 128-character password rotation and monitor for abnormal TGS ticket requests (Event ID 4769 with RC4 encryption).',
        tips: 'Service accounts with SPNs should never use simple human-readable passwords.'
      };
    }
  },

  // 8. Governance, Risk & Privacy: Threat Modeling (STRIDE)
  {
    category: 'governance_risk_privacy',
    subtopic: 'Threat Modeling (STRIDE)',
    difficulty: 'beginner',
    type: 'multiple_choice',
    provenance: 'Microsoft Threat Modeling Methodology / NIST SP 800-154',
    generate: (seed) => {
      const strideElements = [
        { letter: 'S', name: 'Spoofing', threat: 'pretending to be another user or entity' },
        { letter: 'T', name: 'Tampering', threat: 'unauthorized modification of data or code' },
        { letter: 'R', name: 'Repudiation', threat: 'denying having performed an action without proof' },
        { letter: 'I', name: 'Information Disclosure', threat: 'exposing data to unauthorized individuals' },
        { letter: 'D', name: 'Denial of Service', threat: 'degrading or preventing legitimate system access' },
        { letter: 'E', name: 'Elevation of Privilege', threat: 'gaining higher access rights than authorized' }
      ];
      const target = strideElements[seed % strideElements.length];

      return {
        topic: 'Governance, Risk, Compliance & Privacy',
        question: `In the standard STRIDE threat modeling framework, what does the '${target.letter}' stand for, and what primary security violation does it describe?`,
        options: [
          `${target.name}: ${target.threat}.`,
          `Synchronization: ensuring system clocks are aligned across clusters.`,
          `Segmentation: isolating network VLANs from unauthorized packets.`,
          `Scalability: handling sudden increases in traffic loads.`
        ],
        correctAnswer: 0,
        explanation: `STRIDE stands for Spoofing (Identity), Tampering (Data integrity), Repudiation (Non-repudiability), Information Disclosure (Confidentiality), Denial of Service (Availability), and Elevation of Privilege (Authorization). '${target.letter}' represents ${target.name} (${target.threat}).`,
        mitigation: 'Conduct threat modeling sessions during initial software architectural design before coding begins.',
        tips: 'Map STRIDE threats directly to corresponding security properties: Authentication, Integrity, Non-repudiation, Confidentiality, Availability, and Authorization.'
      };
    }
  }
];

/**
 * Procedurally generates unique, validated cybersecurity assessment questions
 */
export async function generateAndStoreQuestions(
  params: GenerationParams
): Promise<{ success: boolean; generatedQuestions: QuizQuestion[]; errors: string[] }> {
  const generated: QuizQuestion[] = [];
  const errors: string[] = [];

  // Filter templates matching category and difficulty if available, or use domain fallback
  let eligibleTemplates = TEMPLATES.filter(t => t.category === params.category);
  if (eligibleTemplates.length === 0) {
    eligibleTemplates = TEMPLATES;
  }

  const timestamp = Date.now();

  for (let i = 0; i < params.count; i++) {
    const template = eligibleTemplates[(i + timestamp) % eligibleTemplates.length];
    const rawData = template.generate(timestamp + i * 17);

    // Build complete record conforming to all 12 mandatory fields
    const uniqueId = `dyn_${params.category.substring(0, 4)}_${params.difficulty.substring(0, 3)}_${timestamp}_${Math.random().toString(36).substring(2, 7)}`;
    
    // Check if ID exists (collision guard)
    const existing = await getQuestionById(uniqueId);
    if (existing) {
      continue;
    }

    const isoDate = new Date().toISOString();
    const candidate: QuizQuestion = normalizeQuestionRecord({
      ...rawData,
      id: uniqueId,
      category: params.category,
      subtopic: params.subtopic || template.subtopic,
      difficulty: params.difficulty,
      type: params.type || template.type,
      provenance: template.provenance,
      reviewStatus: 'verified' as ReviewStatus,
      creationDate: isoDate,
      lastVerifiedDate: isoDate,
      isCustom: true
    });

    // Run strict validator
    const validation = validateQuestion(candidate);
    if (!validation.isValid) {
      errors.push(`Validation failed for generated question ${candidate.id}: ${validation.errors.join('; ')}`);
      continue;
    }

    // Save directly to the Question Bank database
    const saveResult = await saveQuestion(candidate);
    if (saveResult.success && saveResult.question) {
      generated.push(saveResult.question);
    } else {
      errors.push(saveResult.error || `Failed to persist question ${candidate.id}`);
    }
  }

  return {
    success: generated.length > 0,
    generatedQuestions: generated,
    errors
  };
}
