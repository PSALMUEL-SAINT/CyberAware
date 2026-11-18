export interface PasswordStrengthResult {
	score: number;
	label: 'Very Weak' | 'Weak' | 'Moderate' | 'Strong' | 'Very Strong';
	color: string;
	hasMinLength: boolean;
	hasUppercase: boolean;
	hasLowercase: boolean;
	hasNumber: boolean;
	hasSpecialChar: boolean;
	isCommonWord: boolean;
	feedback: string[];
	estimatedCrackTime: string;
}

const COMMON_PASSWORDS = new Set([
	'password', 'password123', 'admin', 'admin123', '123456', '12345678',
	'qwerty', 'letmein', 'welcome', 'cybersecurity', 'cyberaware', 'iloveyou'
]);

/**
 * Evaluates password strength following NIST SP 800-63B and educational guidelines.
 * Emphasizes passphrase length over artificial symbol requirements while encouraging good entropy.
 */
export function evaluatePasswordEntropy(password: string): PasswordStrengthResult {
	const feedback: string[] = [];
	const cleanPass = password || '';

	const hasMinLength = cleanPass.length >= 8;
	const hasGoodLength = cleanPass.length >= 12;
	const hasUppercase = /[A-Z]/.test(cleanPass);
	const hasLowercase = /[a-z]/.test(cleanPass);
	const hasNumber = /[0-9]/.test(cleanPass);
	const hasSpecialChar = /[^A-Za-z0-9]/.test(cleanPass);
	const isCommonWord = COMMON_PASSWORDS.has(cleanPass.toLowerCase().trim());

	let rawScore = 0;

	if (isCommonWord) {
		return {
			score: 0,
			label: 'Very Weak',
			color: '#ef4444',
			hasMinLength,
			hasUppercase,
			hasLowercase,
			hasNumber,
			hasSpecialChar,
			isCommonWord: true,
			feedback: ['This password appears in common breach lists. Choose a unique passphrase.'],
			estimatedCrackTime: '< 1 second'
		};
	}

	if (cleanPass.length >= 8) rawScore += 1;
	if (hasGoodLength) rawScore += 1;
	if (hasUppercase && hasLowercase) rawScore += 1;
	if (hasNumber && hasSpecialChar) rawScore += 1;
	if (cleanPass.length >= 16) rawScore += 1;

	if (!hasMinLength) {
		feedback.push('Use at least 8 characters (12+ recommended for strong defense).');
	}
	if (!hasUppercase) {
		feedback.push('Add uppercase letters to increase character space.');
	}
	if (!hasLowercase) {
		feedback.push('Add lowercase letters.');
	}
	if (!hasNumber) {
		feedback.push('Include numbers.');
	}
	if (!hasSpecialChar) {
		feedback.push('Include symbols (e.g. !@#$%^&*).');
	}

	let label: PasswordStrengthResult['label'] = 'Very Weak';
	let color = '#ef4444';
	let estimatedCrackTime = '< 1 second';

	if (rawScore === 0 || cleanPass.length < 6) {
		label = 'Very Weak';
		color = '#ef4444';
		estimatedCrackTime = '< 1 second';
	} else if (rawScore === 1 || cleanPass.length < 8) {
		label = 'Weak';
		color = '#f97316';
		estimatedCrackTime = 'A few seconds to hours';
	} else if (rawScore === 2) {
		label = 'Moderate';
		color = '#eab308';
		estimatedCrackTime = 'Several days to months';
	} else if (rawScore === 3) {
		label = 'Strong';
		color = '#10b981';
		estimatedCrackTime = 'Years to decades';
	} else {
		label = 'Very Strong';
		color = '#059669';
		estimatedCrackTime = 'Centuries (resilient against offline GPU cracking)';
	}

	return {
		score: Math.min(rawScore, 4),
		label,
		color,
		hasMinLength,
		hasUppercase,
		hasLowercase,
		hasNumber,
		hasSpecialChar,
		isCommonWord,
		feedback: feedback.length === 0 ? ['Excellent security entropy. Strong defense against offline cracking.'] : feedback,
		estimatedCrackTime
	};
}
