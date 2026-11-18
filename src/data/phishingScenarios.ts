import { PhishingScenario } from '../types';

export const PHISHING_SCENARIOS: PhishingScenario[] = [
  {
    id: 'scenario_student_portal',
    title: 'Urgent University Student Portal Suspension',
    channel: 'email',
    senderDisplay: 'Campus IT Helpdesk Services',
    senderAddress: 'it-security-notice@campus-auth-desk77.net',
    subject: 'URGENT: Your Student Portal Account Will Be Terminated in 12 Hours',
    dateStr: 'Today, 8:42 AM',
    bodyText: [
      'Dear Valued Student / Faculty Member,',
      'We detected irregular synchronization attempts from an unrecognized IP address (St. Petersburg, RU). For your protection, your university email, course registration access, and cloud drive will be permanently deactivated within 12 hours.',
      'To prevent account loss and retain access, you must immediately confirm your identity and re-authenticate your institutional credentials via our upgraded multi-factor portal below.'
    ],
    simulatedLink: {
      anchorText: 'Re-authenticate My Student Account Now →',
      hoverUrl: 'https://campus-student-login.net-auth77.org/verify?session=x92jfk',
      isSuspicious: true
    },
    attachment: {
      fileName: 'Account_Termination_Notice_Scan.pdf.html',
      fileSize: '48 KB',
      isSuspicious: true
    },
    isPhishing: true,
    threatLevel: 'critical',
    redFlags: [
      {
        id: 'rf_sender_domain',
        title: 'Suspicious External Domain',
        description: 'The email claims to be your university IT helpdesk, but the sender domain is "campus-auth-desk77.net" rather than your university\'s genuine ".edu" domain.',
        targetElement: 'sender'
      },
      {
        id: 'rf_urgent_threat',
        title: 'Artificial Panic & False Deadline',
        description: 'Threatening "Permanent deactivation within 12 hours" is a textbook coercion tactic designed to rush you into reacting before verifying.',
        targetElement: 'urgency'
      },
      {
        id: 'rf_mismatched_url',
        title: 'Deceptive Link Destination',
        description: 'The button promises account verification, but points to a suspicious third-party site ("net-auth77.org") that harvests entered passwords.',
        targetElement: 'link'
      },
      {
        id: 'rf_dangerous_attachment',
        title: 'Double-Extension Malicious Attachment',
        description: 'The attached file is named ".pdf.html". Opening an HTML attachment in your browser executes client-side credential harvester code.',
        targetElement: 'attachment'
      },
      {
        id: 'rf_generic_greeting',
        title: 'Impersonal Salutation',
        description: '"Dear Valued Student / Faculty Member" indicates a bulk spray-and-pray phishing campaign rather than a personalized administrative notice.',
        targetElement: 'greeting'
      }
    ],
    safeAction: 'Do not click the button and do not open the attachment. Report the message to your campus IT security desk and delete it.',
    explanation: 'This is a high-risk credential harvester mimicking educational institutions to steal academic portal access and student financial details.'
  },
  {
    id: 'scenario_delivery_sms',
    title: 'Parcel Courier Incomplete Address Notice',
    channel: 'sms',
    senderDisplay: '+1 (833) 492-0198',
    senderAddress: '+18334920198',
    subject: 'Package Delivery Update',
    dateStr: 'Yesterday, 3:15 PM',
    bodyText: [
      '[USPS Express] Package tracking #US-8849-NX could not be delivered due to missing house number or zip code discrepancy.',
      'A minor redelivery and storage handling fee of $1.85 is required to reschedule delivery for tomorrow morning.',
      'Please update your delivery address and confirm payment within 24 hours to avoid parcel return.'
    ],
    simulatedLink: {
      anchorText: 'http://usps-parcel-redelivery-center.top/resolve',
      hoverUrl: 'http://usps-parcel-redelivery-center.top/resolve',
      isSuspicious: true
    },
    isPhishing: true,
    threatLevel: 'high',
    redFlags: [
      {
        id: 'rf_sms_short_domain',
        title: 'Unfamiliar Top-Level Domain (.top)',
        description: 'Legitimate United States Postal Service communications use USPS.com, never unverified foreign TLDs like ".top".',
        targetElement: 'link'
      },
      {
        id: 'rf_credit_card_lure',
        title: 'Trivial Fee Lure ($1.85)',
        description: 'The small fee ($1.85) is psychological bait. Scammers don\'t want $1.85; they want you to enter your credit card number, CVV, and billing address on their fake payment portal.',
        targetElement: 'urgency'
      },
      {
        id: 'rf_unsolicited_sms',
        title: 'Unsolicited Text from Random Toll-Free Number',
        description: 'Major couriers do not text you regarding address errors unless you explicitly enrolled in tracking alerts for a specific package.',
        targetElement: 'sender'
      }
    ],
    safeAction: 'Never click the link. If you are expecting a package, visit USPS.com or the courier app directly and search your tracking code.',
    explanation: 'This is an example of Smishing (SMS Phishing) designed to capture payment card details through a deceptive low-fee pretense.'
  },
  {
    id: 'scenario_bank_legit',
    title: 'Authentic Bank Security Sign-In Alert',
    channel: 'email',
    senderDisplay: 'Apex Horizon Bank Alert Center',
    senderAddress: 'alerts@mail.apexhorizonbank.com',
    subject: 'Security Alert: New Sign-in from Chrome on Windows',
    dateStr: 'Oct 26, 2:10 PM',
    bodyText: [
      'Hello Alex,',
      'We noticed a new sign-in to your Apex Horizon Bank digital banking account on Oct 26, 2026 at 2:09 PM EDT from Chrome on Windows.',
      'If this was you, you can safely disregard this message. No further action is required.',
      'If you did NOT authorize this sign-in, please protect your account immediately by logging into our official mobile app or visiting apexhorizonbank.com in your web browser and updating your password under Security Settings.'
    ],
    simulatedLink: {
      anchorText: 'Learn more about protecting your digital account on apexhorizonbank.com',
      hoverUrl: 'https://www.apexhorizonbank.com/security/overview',
      isSuspicious: false
    },
    isPhishing: false,
    threatLevel: 'low',
    redFlags: [],
    safeAction: 'This is a legitimate informational security notice. It addresses you by name, does NOT contain panic deadlines, and directs you to open the official app independently rather than forcing you to click a login link.',
    explanation: 'Legitimate security alerts inform you of actions and advise you to navigate to their official portal independently without demanding credentials or creating artificial emergency deadlines.'
  },
  {
    id: 'scenario_hr_direct_deposit',
    title: 'Urgent Direct Deposit Bank Routing Change',
    channel: 'email',
    senderDisplay: 'Sarah Jenkins (VP Operations)',
    senderAddress: 'sarah.jenkins.corp@executive-mail-router.com',
    subject: 'Quick question / Urgent bank account update for this Friday payroll',
    dateStr: 'Oct 27, 10:14 AM',
    bodyText: [
      'Hi there,',
      'I am currently caught in a closed-door board meeting and cannot take calls. I need to update my direct deposit bank account details before payroll closes at noon today.',
      'Can you quickly confirm whether you need my updated void check or just the new routing and account number? Please send the direct submission link or reply directly to this email so I can forward the new routing details ASAP.',
      'Thanks for the quick turnaround.',
      'Sarah Jenkins'
    ],
    isPhishing: true,
    threatLevel: 'high',
    redFlags: [
      {
        id: 'rf_pretext_authority',
        title: 'Authority Pretexting & Busy Defense',
        description: 'The sender claims to be in a closed-door meeting to preempt you from calling or walking over to verify the request in person.',
        targetElement: 'urgency'
      },
      {
        id: 'rf_spoofed_external_service',
        title: 'External Free/Masked Mail Server',
        description: 'The sender address uses "@executive-mail-router.com" instead of your company or organization\'s internal email domain.',
        targetElement: 'sender'
      },
      {
        id: 'rf_financial_diversion',
        title: 'Payroll Diversion Attempt',
        description: 'Diverting payroll direct deposits is one of the most common and financially devastating Business Email Compromise (BEC) attacks.',
        targetElement: 'subject'
      }
    ],
    safeAction: 'Do not reply and do not update any account numbers. Always verify payroll and wire transfer requests through an established out-of-band procedure (e.g. speaking in person or calling a known internal desk extension).',
    explanation: 'This is a Business Email Compromise (BEC) social engineering attack attempting to divert salary deposits into an attacker-controlled bank mule account.'
  },
  {
    id: 'scenario_cloud_storage',
    title: 'Cloud Drive Storage Critical Warning',
    channel: 'email',
    senderDisplay: 'Cloud Storage Notification Service',
    senderAddress: 'storage-team@cloud-quota-warning-center.info',
    subject: 'ACTION REQUIRED: 99.8% Storage Full - Incoming Emails Will Bounce',
    dateStr: 'Today, 7:12 AM',
    bodyText: [
      'Notification ID: #MS-QUOTA-99120',
      'Your mailbox and connected cloud drive have reached 14.97 GB of 15.00 GB (99.8%).',
      'Starting today at 6:00 PM, all incoming emails from teachers, employers, and contacts will be rejected and permanently discarded.',
      'To prevent email loss and add 50 GB of complimentary student storage, validate your account quota below.'
    ],
    simulatedLink: {
      anchorText: 'Upgrade Storage & Prevent Bounces Free →',
      hoverUrl: 'https://login-microsoftonline.cloud-sync-verify.com.ru/auth/login.php',
      isSuspicious: true
    },
    isPhishing: true,
    threatLevel: 'critical',
    redFlags: [
      {
        id: 'rf_bait_free_storage',
        title: 'Complimentary Storage Bait',
        description: 'Offering "50 GB complimentary student storage" serves as psychological bait to entice immediate action.',
        targetElement: 'urgency'
      },
      {
        id: 'rf_deceptive_subdomain',
        title: 'Deceptive Subdomain Cloaking (.com.ru)',
        description: 'Notice the URL: "login-microsoftonline.cloud-sync-verify.com.ru". The legitimate company name is placed at the front as a trick subdomain, while the actual domain is hosted on an overseas server.',
        targetElement: 'link'
      },
      {
        id: 'rf_panic_consequences',
        title: 'Threat of Permanent Message Deletion',
        description: 'Claiming that all incoming emails will be permanently rejected within hours is designed to spark panic.',
        targetElement: 'subject'
      }
    ],
    safeAction: 'Do not click the button. Check your cloud drive or mailbox quota directly through your authorized cloud app or web browser bookmark.',
    explanation: 'This attack mimics legitimate cloud storage notifications, using fear of lost emails to direct users to an overseas credential harvesting form.'
  }
];
