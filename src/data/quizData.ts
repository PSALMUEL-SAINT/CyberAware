import { QuizQuestion } from '../types';
import { ALL_ASSESSMENT_QUESTIONS, ASSESSMENT_CATEGORIES, filterQuestions, getQuestionsByCategory, getQuestionsByDifficulty } from './assessmentData';

export const STARTER_QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 'q1',
    topic: 'Phishing',
    category: 'security_awareness_identity',
    subcategory: 'Phishing & Smishing',
    difficulty: 'beginner',
    type: 'multiple_choice',
    question: 'You receive an urgent email from "Campus Financial Aid" stating your scholarship will be canceled unless you log in within 4 hours. You hover over the login button and the destination URL reads: "http://campus-aid-portal.secure-verify-912.com/login". What is the safest course of action?',
    options: [
      'Click the link and log in immediately so your financial aid is not canceled.',
      'Reply to the email asking if it is authentic.',
      'Do not click the link; open a new tab, navigate to your official school portal directly, and check your status or contact the financial aid office.',
      'Forward the email with your password to your friend to see if they got it too.'
    ],
    correctAnswer: 2,
    correctAnswers: [2],
    explanation: 'The destination domain is "secure-verify-912.com", NOT your campus\'s legitimate domain (e.g. campus.edu). Attackers use fabricated urgency (4-hour deadline) to induce panic. Always navigate to portals independently.',
    tips: 'The true destination of a web link is determined by the domain immediately preceding the first single slash (/), not what the text in the email claims.'
  },
  {
    id: 'q2',
    topic: 'Password Security',
    category: 'security_awareness_identity',
    subcategory: 'Credential Hygiene',
    difficulty: 'beginner',
    type: 'multiple_choice',
    question: 'Which of the following passwords offers the highest resistance against modern brute-force cracking tools?',
    options: [
      'P@ssw0rd1!',
      'blue-horizon-guitar-waffle-78',
      'Admin2024$',
      'X9!mQ'
    ],
    correctAnswer: 1,
    correctAnswers: [1],
    explanation: '"blue-horizon-guitar-waffle-78" is 29 characters long and uses a multi-word passphrase structure. In cryptography, character length contributes exponentially more entropy than substituting letters for symbols in short predictable words.',
    tips: 'A 4-word passphrase with 20+ characters takes thousands of years to crack with GPU clusters, while 8-character passwords with symbols can be cracked in minutes.'
  },
  {
    id: 'q3',
    topic: 'Multi-Factor Authentication',
    category: 'security_awareness_identity',
    subcategory: 'Authentication & MFA',
    difficulty: 'beginner',
    type: 'multiple_choice',
    question: 'At 2:30 AM while sleeping, you receive three successive push notifications on your phone asking you to "Approve Login from Moscow, Russia". What attack is occurring, and how should you respond?',
    options: [
      'Tap "Approve" so the notifications stop waking you up.',
      'This is an "MFA Fatigue" attack; deny the login requests immediately, change your master password, and review recent sessions.',
      'Ignore it; MFA automatically changes your password after 5 attempts.',
      'Reply with your phone PIN to cancel the login.'
    ],
    correctAnswer: 1,
    correctAnswers: [1],
    explanation: 'This is an MFA Fatigue (or push bombing) attack. The attacker already has your password and is spamming your phone hoping you will approve in frustration or confusion. Always deny unsolicited prompts and change your password.',
    tips: 'Never approve any authentication prompt unless you triggered it seconds prior on your own device.'
  },
  {
    id: 'q4',
    topic: 'Safe Browsing',
    category: 'security_awareness_identity',
    subcategory: 'Safe Browsing',
    difficulty: 'beginner',
    type: 'multiple_choice',
    question: 'You visit a website and observe a valid padlock icon (HTTPS) in your browser address bar. Does this guarantee that the website is honest and safe to enter credit card information?',
    options: [
      'Yes, the padlock means the website was verified by the FBI or cyber police as trustworthy.',
      'Yes, HTTPS means the business is legitimate and cannot steal your data.',
      'No, HTTPS only means communication between your browser and the website is encrypted; cybercriminals routinely put HTTPS on phishing websites.',
      'No, the padlock only appears when your antivirus software is turned off.'
    ],
    correctAnswer: 2,
    correctAnswers: [2],
    explanation: 'HTTPS encrypts data in transit to prevent eavesdropping on the network. However, free automated certificates allow cybercriminals to set up HTTPS on phishing sites in minutes. Always verify the actual domain name.',
    tips: 'A padlock means "private connection", not "trustworthy merchant". Always check the domain spelling carefully.'
  },
  {
    id: 'q5',
    topic: 'Phishing',
    category: 'security_awareness_identity',
    subcategory: 'Phishing & Smishing',
    difficulty: 'beginner',
    type: 'multiple_choice',
    question: 'You receive an SMS text: "USPS Alert: Your package #US9842 has an incomplete address and cannot be delivered. Click http://usps-redelivery-fee.top/track to update info within 12h or it will be returned." What is this?',
    options: [
      'A standard United States Postal Service operational message.',
      'Smishing (SMS phishing) designed to capture your credit card details via a fake address update fee.',
      'A software bug in your cellular provider network.',
      'An emergency delivery that requires immediate payment.'
    ],
    correctAnswer: 1,
    correctAnswers: [1],
    explanation: 'Postal services do not text from random numbers with unusual top-level domains like ".top" asking for small redelivery fees. This is a classic smishing scam aimed at stealing credit card credentials.',
    tips: 'Legitimate courier services never demand credit card payment via unsolicited text messages for address corrections.'
  },
  {
    id: 'q6',
    topic: 'Social Engineering',
    category: 'security_awareness_identity',
    subcategory: 'Social Engineering',
    difficulty: 'beginner',
    type: 'multiple_choice',
    question: 'You receive an email purportedly from your organization\'s CEO or department head saying: "I am trapped in an urgent meeting with investors and need you to urgently buy 5 $100 gift cards and email the redemption codes. Keep this confidential." What should you do?',
    options: [
      'Run to the nearest convenience store immediately to impress your boss.',
      'Recognize this as the classic "Executive Impersonation / Gift Card" scam; do not buy gift cards, and verify with your boss via phone or in person.',
      'Ask the sender to reimburse you first through PayPal before buying.',
      'Forward the email to the local police department without notifying your company.'
    ],
    correctAnswer: 1,
    correctAnswers: [1],
    explanation: 'Gift cards are non-refundable and untraceable once redeemed, making them the favorite currency of social engineering scammers. Executives do not conduct business operations by asking staff to purchase gift cards via urgent secret emails.',
    tips: 'Any request for urgent payment via gift cards, wire transfers, or cryptocurrency is almost certainly a scam.'
  },
  {
    id: 'q7',
    topic: 'Safe Browsing',
    category: 'network_security',
    subcategory: 'Zero Trust & Segmentation',
    difficulty: 'beginner',
    type: 'multiple_choice',
    question: 'You are studying at a busy local cafe and connect to "CoffeeShop_Guest_Free" Wi-Fi without a password. What precaution should you take?',
    options: [
      'None; public Wi-Fi is monitored by city cybersecurity teams.',
      'Use a trustworthy VPN or mobile hotspot, and avoid logging into banking or high-security accounts on unsecured public networks.',
      'Turn off your laptop monitor so people behind you cannot see your screen.',
      'Change your email password while connected to the coffee shop network.'
    ],
    correctAnswer: 1,
    correctAnswers: [1],
    explanation: 'Unencrypted public Wi-Fi allows anyone within radio range to monitor network traffic or create spoofed duplicate access points. Using a reputable VPN encrypts all traffic regardless of network security.',
    tips: 'If you must work on sensitive accounts in public, tether to your phone\'s cellular hotspot instead of open public Wi-Fi.'
  },
  {
    id: 'q8',
    topic: 'Password Security',
    category: 'security_awareness_identity',
    subcategory: 'Credential Hygiene',
    difficulty: 'beginner',
    type: 'multiple_choice',
    question: 'Why is using the exact same password for your personal email and an online gaming forum considered a dangerous habit?',
    options: [
      'Because gaming forums automatically deduct money from your email account.',
      'If the gaming forum suffers a security breach, attackers will use "credential stuffing" to try your password on your email, banking, and social accounts.',
      'Passwords expire twice as fast when used on two different websites.',
      'Browsers do not allow the same password to be stored twice.'
    ],
    correctAnswer: 1,
    correctAnswers: [1],
    explanation: 'Automated credential stuffing bots test millions of leaked username/password combos against hundreds of popular services. If an attacker breaches a low-security forum, they gain the keys to your high-value accounts.',
    tips: 'Your primary email is the gateway to your digital life (it receives password reset links). It must always have a unique, strong password with MFA enabled.'
  },
  {
    id: 'q9',
    topic: 'Social Engineering',
    category: 'security_awareness_identity',
    subcategory: 'Social Engineering',
    difficulty: 'beginner',
    type: 'multiple_choice',
    question: 'A caller claiming to be "Windows Support" states that your computer is sending error signals across the internet and demands you install remote software (like AnyDesk) so they can fix it. How should you respond?',
    options: [
      'Follow their instructions promptly so your computer does not get deleted.',
      'Give them your credit card number over the phone to pay the diagnosis fee.',
      'Hang up immediately; major tech companies like Microsoft and Apple do not place unsolicited cold calls regarding computer errors.',
      'Ask them to email you their company ID badge first.'
    ],
    correctAnswer: 2,
    correctAnswers: [2],
    explanation: 'Unsolicited tech support calls are 100% fraudulent. Tech giants do not monitor individual consumer devices for error signals and will never call you out of the blue demanding remote control.',
    tips: 'Never permit an unsolicited caller to gain remote access to your computer. Hang up immediately.'
  },
  {
    id: 'q10',
    topic: 'Multi-Factor Authentication',
    category: 'security_awareness_identity',
    subcategory: 'Authentication & MFA',
    difficulty: 'beginner',
    type: 'multiple_choice',
    question: 'When configuring Multi-Factor Authentication (MFA) on an account, why is an Authenticator app (TOTP) generally preferred over SMS text messages?',
    options: [
      'Authenticator apps are free while SMS always costs $5 per message.',
      'SMS is susceptible to SIM-swapping attacks, cellular network intercepts, and phone lock-screen preview snooping.',
      'Authenticator apps never require you to own a smartphone.',
      'SMS codes can only be used on Android devices.'
    ],
    correctAnswer: 1,
    correctAnswers: [1],
    explanation: 'SMS verification codes can be intercepted through SIM-swapping (where an attacker convinces a phone carrier to move your number to their SIM card) or SS7 network vulnerabilities. Authenticator apps generate codes locally using offline cryptography.',
    tips: 'Upgrade your primary accounts from SMS 2FA to an authenticator app (such as Google Authenticator, Aegis, or Microsoft Authenticator).'
  },
  {
    id: 'q11',
    topic: 'Safe Browsing',
    category: 'web_appsec',
    subcategory: 'Secure Coding Practices',
    difficulty: 'beginner',
    type: 'multiple_choice',
    question: 'While installing a free PDF conversion browser extension, the store prompts you: "This extension can read and change all your data on all websites you visit". What is the security implication?',
    options: [
      'It is a standard harmless notice that every website requires.',
      'The extension has full permission to log your keystrokes, read sensitive emails, and capture banking session tokens across any tab you open.',
      'The extension will automatically protect all websites you visit from hackers.',
      'The permission only applies while you are downloading a PDF.'
    ],
    correctAnswer: 1,
    correctAnswers: [1],
    explanation: 'Broad extension permissions ("read and change all data on all websites") grant powerful capabilities. Malicious or compromised extensions have previously been used to steal passwords, session cookies, and inject adware.',
    tips: 'Only install browser extensions from reputable developers with large user bases and positive reviews, and audit installed extensions regularly.'
  },
  {
    id: 'q12',
    topic: 'Password Security',
    category: 'security_awareness_identity',
    subcategory: 'Credential Hygiene',
    difficulty: 'beginner',
    type: 'multiple_choice',
    question: 'Where is the safest place to store the one-time backup recovery codes provided when you first set up MFA on your accounts?',
    options: [
      'In a plain text file on your desktop titled "PASSWORDS_AND_CODES.txt".',
      'In a screenshot saved to your public cloud photos album.',
      'In an encrypted password manager vault or a printed physical document kept in a secure personal safe.',
      'Shared in an unencrypted group chat with friends in case you forget.'
    ],
    correctAnswer: 2,
    correctAnswers: [2],
    explanation: 'MFA recovery codes bypass the second factor entirely. If stored in unencrypted text files or photos, any malware or cloud breach exposes them. Store them in an encrypted vault or locked physical location.',
    tips: 'Treat recovery codes with the same level of care you would give a physical spare house key.'
  }
];

// Combine starter and advanced assessment questions into the primary bank
export const QUIZ_QUESTIONS: QuizQuestion[] = [
  ...STARTER_QUIZ_QUESTIONS,
  ...ALL_ASSESSMENT_QUESTIONS
];

export {
  ALL_ASSESSMENT_QUESTIONS,
  ASSESSMENT_CATEGORIES,
  filterQuestions,
  getQuestionsByCategory,
  getQuestionsByDifficulty
};
