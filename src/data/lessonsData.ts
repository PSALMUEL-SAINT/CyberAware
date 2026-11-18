import { LessonModule } from '../types';

export const LESSONS_DATA: LessonModule[] = [
  {
    id: 'phishing_101',
    title: 'Phishing & Email Deception',
    subtitle: 'Learn how to spot deceptive emails, smishing texts, and forged sender identities.',
    category: 'phishing',
    readTimeMinutes: 5,
    iconName: 'MailWarning',
    summary: 'Phishing accounts for over 80% of reported security incidents. Attackers manipulate emotions like fear, urgency, or curiosity to get you to click malicious links or give away login credentials.',
    sections: [
      {
        title: 'The Anatomy of a Phishing Attack',
        content: [
          'Phishing is a social engineering technique where attackers impersonate trustworthy organizations (banks, universities, streaming services, tech companies) to trick you into sharing sensitive information.',
          'Attackers construct fake login portals that look identical to genuine sites, capture your credentials the moment you type them, and immediately use or resell them on underground forums.',
          'Modern phishing goes beyond email: "Smishing" uses SMS text messages (e.g. fake postal delivery notices), and "Vishing" uses voice telephone calls or automated robocalls.'
        ],
        takeaway: 'Never trust sender display names alone. Always verify the actual email domain after the "@" symbol.',
        warningNotice: 'Legitimate organizations will rarely threaten immediate account termination within 24 hours via an unprompted email.',
        practicalExample: {
          good: 'Display: University IT Desk <support@campus.edu>',
          bad: 'Display: University IT Desk <support-campus-portal-alert@auth-security99.net>',
          explanation: 'Attackers can customize the display name to anything, but the actual sending server domain reveals the fraud.'
        }
      },
      {
        title: 'Crucial Red Flags to Watch For',
        content: [
          'Artificial Urgency: Phishers love phrases like "Immediate Action Required", "Account Suspended in 2 Hours", or "Final Warning". Urgency bypasses your critical thinking.',
          'Mismatched URLs: An email may show text saying "www.mybank.com/login", but hovering your cursor over it reveals the actual link points to an unrelated strange domain.',
          'Generic or Awkward Greetings: Messages starting with "Dear Customer" or "Dear User" instead of your actual name or account handle.',
          'Unexpected Attachments: Files ending in .zip, .html, .iso, or macros in Word documents (.docm) can instantly execute malicious scripts.'
        ],
        takeaway: 'Before clicking any link in an email, hover over it (or long-press on mobile) to inspect the destination domain.'
      },
      {
        title: 'What to Do If You Suspect Phishing',
        content: [
          'Do not click any embedded buttons or download attachments.',
          'Never reply to the message to ask "Is this real?" — attackers will just reply "Yes, it is".',
          'Navigate independently: open a fresh browser tab and manually type the known official address of the company or institution.',
          'Report the email to your school/work IT department or forward phishing emails to official reporting bodies (like reportphishing@apwg.org).'
        ],
        takeaway: 'When in doubt, verify via an independent channel that you initiated.'
      }
    ],
    actionChecklist: [
      'Always hover over links to inspect the destination URL before clicking',
      'Check the full sender email address, especially the domain name',
      'Be skeptical of any urgent demand for credentials, money, or gift cards',
      'Never open unexpected .zip, .exe, or .html attachments',
      'When an alert seems alarming, verify via the official website or app independently'
    ]
  },
  {
    id: 'password_security',
    title: 'Password Security & Passphrases',
    subtitle: 'Why length beats complexity, how password managers work, and avoiding credential reuse.',
    category: 'passwords',
    readTimeMinutes: 6,
    iconName: 'KeyRound',
    summary: 'Most users reuse passwords across dozens of websites. When one obscure forum is breached, attackers use automated credential stuffing to break into personal email and financial accounts.',
    sections: [
      {
        title: 'Length vs. Complexity: The Math of Cracking',
        content: [
          'For years, users were told to create short, convoluted passwords like "P@$$w0rd!1". These are hard for humans to remember, but automated graphics card clusters can crack them in seconds.',
          'A long passphrase made of 4 or 5 random, memorable words (e.g., "coffee-orbit-jacket-forest") is astronomically harder for computers to brute force, while remaining easy for you to type.',
          'Every character added to a password exponentially increases the combinations an attacker has to test.'
        ],
        takeaway: 'Aim for a minimum of 14-16 characters or a 4+ word passphrase.',
        practicalExample: {
          good: 'Passphrase: "sunset-velvet-tulip-gravity-88" (29 characters, centuries to crack)',
          bad: 'Complex short: "Tr0ub4dor&3" (11 characters, cracked in minutes on GPU rigs)',
          explanation: 'Passphrases provide vastly superior mathematical entropy without cognitive strain.'
        }
      },
      {
        title: 'The Deadly Trap of Password Reuse',
        content: [
          'Over 60% of people admit to using the same password across multiple websites.',
          'When an insecure shopping site or forum suffers a database breach, your email and password leak onto the dark web.',
          'Hackers run automated tools called "Credential Stuffing" bots that feed these leaked combinations into Google, Microsoft, PayPal, Netflix, and Amazon within hours.'
        ],
        takeaway: 'Never use the same password for your primary email or banking that you use anywhere else.'
      },
      {
        title: 'Why Password Managers Are Essential',
        content: [
          'Human memory cannot securely store 100+ unique, 20-character passwords. Password managers (such as Bitwarden, 1Password, or Apple Keychain) solve this safely.',
          'They generate ultra-strong unique strings for every account and autofill them only on the authentic domain—which also protects you from phishing websites!',
          'You only ever need to memorize one strong master passphrase.'
        ],
        takeaway: 'Adopt a reputable password manager so every online account has a unique, high-entropy key.'
      }
    ],
    actionChecklist: [
      'Stop reusing passwords across critical accounts (email, bank, school portal)',
      'Use multi-word passphrases of at least 15+ characters',
      'Adopt a password manager to generate and store unique credentials',
      'Check if your email has appeared in public breaches via HaveIBeenPwned',
      'Never share passwords over unencrypted messaging apps or sticky notes'
    ]
  },
  {
    id: 'mfa_security',
    title: 'Multi-Factor Authentication (MFA)',
    subtitle: 'The single most effective defense against automated account takeover.',
    category: 'authentication',
    readTimeMinutes: 5,
    iconName: 'ShieldCheck',
    summary: 'Microsoft and Google research shows that enabling Multi-Factor Authentication blocks over 99% of bulk automated credential attacks.',
    sections: [
      {
        title: 'What Is Multi-Factor Authentication?',
        content: [
          'Authentication factors fall into three core categories: 1) Something you KNOW (password, PIN); 2) Something you HAVE (smartphone, hardware security key, authenticator app); 3) Something you ARE (fingerprint, facial recognition).',
          'Multi-Factor Authentication requires two or more distinct categories before granting access. Even if an attacker steals your password in a phishing attack, they cannot log in without your physical device.'
        ],
        takeaway: 'MFA turns a stolen password from a catastrophe into a minor inconvenience.'
      },
      {
        title: 'Authentication Methods Ranked by Security',
        content: [
          'Hardware Security Keys (FIDO2 / YubiKey): The gold standard. Cryptographically bound to the authentic domain, immune to phishing.',
          'Authenticator Apps (Google Authenticator, Microsoft Authenticator, Aegis): Highly secure. Generates time-based 6-digit codes (TOTP) locally on your device with no cellular network vulnerability.',
          'Push Notifications: Convenient, but watch out for "MFA Fatigue" (where hackers spam you with push prompts at 3 AM hoping you accidentally tap "Approve"). Always verify the prompt matches your actual login action.',
          'SMS / Text Message Verification: Better than nothing, but vulnerable to SIM-swapping and cellular interception.'
        ],
        takeaway: 'Prefer authenticator apps or security keys over SMS text codes whenever available.',
        warningNotice: 'Beware of MFA Fatigue: Never approve a login notification on your phone that you did not personally trigger seconds before!'
      },
      {
        title: 'Backup & Recovery Codes',
        content: [
          'When you set up MFA on any service, you are provided with 8-10 one-time recovery codes.',
          'If you lose your phone or drop it in water, recovery codes are your ONLY way to regain access.',
          'Print them out or store them in a secure, encrypted offline vault—never store them in an unencrypted screenshot in your camera roll!'
        ],
        takeaway: 'Always generate and safely store backup recovery codes when enabling MFA.'
      }
    ],
    actionChecklist: [
      'Enable MFA immediately on your primary email, banking, and social accounts',
      'Switch from SMS verification to an Authenticator app (e.g. Google Authenticator)',
      'Safely store backup recovery codes in an encrypted or physical location',
      'Never tap "Approve" on an unexpected push notification',
      'Never share one-time 6-digit verification codes with anyone over phone or chat'
    ]
  },
  {
    id: 'social_engineering',
    title: 'Social Engineering & Human Hacking',
    subtitle: 'Understanding psychological tricks: urgency, authority, baiting, and pretexting.',
    category: 'social_engineering',
    readTimeMinutes: 5,
    iconName: 'UserX',
    summary: 'Social engineering targets human psychology rather than software vulnerabilities. Hackers exploit trust, fear, helpfulness, and curiosity to trick people into breaking security protocols.',
    sections: [
      {
        title: 'The Psychology of the Scam',
        content: [
          'Attackers know that human beings have natural cognitive biases: we respect authority, we fear getting into trouble, we love free gifts, and we want to help someone in distress.',
          'Common Tactics:',
          '1. Authority Impersonation: Posing as your CEO, university dean, law enforcement, or IT director to intimidate you into fast compliance.',
          '2. Pretexting: Fabricating an elaborate story (e.g., "I am from fraud prevention and someone is draining your savings right now").',
          '3. Baiting: Offering free software, pirated media, or leaving infected USB drives in parking lots labeled "Confidential Salaries".'
        ],
        takeaway: 'Whenever someone pressures you to act quickly without questioning, slow down and step back.'
      },
      {
        title: 'Real-Life Social Engineering Scenarios',
        content: [
          'The "Gift Card" Boss Scam: An email that looks like it is from your supervisor saying, "I am stuck in a client meeting and need you to purchase three $100 Apple gift cards for a presentation. Scratch the backs and send photos ASAP."',
          'The Tech Support Robocall: A caller claiming to be Microsoft Windows support saying your computer is sending virus signals, demanding remote access via AnyDesk or TeamViewer.',
          'Shoulder Surfing & Oversharing: Publicly posting answers to common security questions on Instagram or TikTok (e.g., "What was your high school mascot?", "Mother\'s maiden name", "First car").'
        ],
        takeaway: 'Legitimate IT support will never ask for your password, and employers never request gift card reimbursement via text photos.'
      },
      {
        title: 'Building a Defensive Mindset',
        content: [
          'Cultivate healthy skepticism: verify the identity of unexpected requesters through a separate trusted directory.',
          'Never grant remote desktop control to an unsolicited caller.',
          'Review privacy settings on social media to prevent attackers from mining your personal background for security questions.'
        ],
        takeaway: 'It is always acceptable to pause, hang up, or say "I will verify this through official channels first".'
      }
    ],
    actionChecklist: [
      'Pause and breathe when a message triggers panic, urgency, or excitement',
      'Never purchase gift cards or wire money based on an email or SMS request',
      'Never give remote access to your computer to an unsolicited caller',
      'Treat personal details (birthplace, pet names) as sensitive data, not social trivia',
      'Verify unexpected requests by calling the person back on a known phone number'
    ]
  },
  {
    id: 'safe_browsing',
    title: 'Safe Browsing & Network Hygiene',
    subtitle: 'HTTPS padlocks, public Wi-Fi risks, malicious browser extensions, and drive-by downloads.',
    category: 'safe_browsing',
    readTimeMinutes: 6,
    iconName: 'Globe',
    summary: 'Browsing the modern web requires understanding what browser indicators actually mean, how to navigate public Wi-Fi safely, and how to spot untrusted downloads.',
    sections: [
      {
        title: 'The Truth About the HTTPS Padlock',
        content: [
          'Many users believe that the padlock icon in the browser address bar means a website is "safe and trustworthy".',
          'In reality, HTTPS only means the connection between your computer and the server is encrypted. Attackers can—and do—easily obtain free SSL certificates for phishing domains!',
          'A malicious phishing site can have a valid HTTPS lock. The lock protects you from eavesdroppers, not from the site owner being a scammer.'
        ],
        takeaway: 'HTTPS means the connection is private, NOT that the website is trustworthy.',
        warningNotice: 'Over 80% of modern phishing websites display a valid HTTPS padlock.'
      },
      {
        title: 'Public Wi-Fi & Coffee Shop Networks',
        content: [
          'Open public Wi-Fi networks in airports, cafes, and hotels have no password encryption between your laptop and the router.',
          'Attackers on the same network can set up "Evil Twin" hotspots (e.g. naming their rogue hotspot "Airport_Free_WiFi") to intercept unencrypted traffic or attempt DNS redirection.',
          'Defenses:',
          '1. Avoid accessing sensitive bank or medical portals on untrusted open Wi-Fi.',
          '2. Use a trusted Virtual Private Network (VPN) or your mobile phone\'s personal cellular hotspot instead.'
        ],
        takeaway: 'Treat public Wi-Fi as untrusted. Use your mobile hotspot or a reputable VPN for sensitive work.'
      },
      {
        title: 'Rogue Browser Extensions & Malicious Downloads',
        content: [
          'Browser extensions often have permission to "read and change all your data on all websites you visit". A rogue extension can silently log keystrokes and session cookies.',
          'Only install extensions from official stores, check developer reputation, and uninstall extensions you no longer use.',
          'Drive-by downloads: Avoid clicking on fake "Update your browser now" or "Update Flash/Video Codec" banners on streaming or download portals.'
        ],
        takeaway: 'Audit your browser extensions regularly and keep your browser automatically updated.'
      }
    ],
    actionChecklist: [
      'Check the actual domain name in the address bar, not just the HTTPS padlock',
      'Use mobile hotspot or a trustworthy VPN on open public Wi-Fi',
      'Review and remove unused browser extensions every few months',
      'Keep your browser and operating system set to automatic updates',
      'Download software exclusively from authentic developer websites or app stores'
    ]
  }
];
