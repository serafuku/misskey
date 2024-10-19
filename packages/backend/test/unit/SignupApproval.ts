/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, vi } from 'vitest';
import { SignupService } from '@/core/SignupService.js';

describe('signup approval state', () => {
	test.each([
		{ required: false, rootUserId: 'root', approved: true },
		{ required: true, rootUserId: 'root', approved: false },
		{ required: false, rootUserId: null, approved: true },
		{ required: true, rootUserId: null, approved: true },
	])('initializes approval with required=$required, root=$rootUserId', async ({ required, rootUserId, approved }) => {
		const manager = {
			findOneBy: async () => null,
			save: async <T>(entity: T) => entity,
		};
		const service = new SignupService(
			{ transaction: async (fn: (em: typeof manager) => Promise<void>) => fn(manager) } as never,
			{ approvalRequiredForSignup: required, rootUserId, preservedUsernames: [], prohibitedWordsForNameOfUser: [] } as never,
			{ exists: async () => false } as never,
			{ exists: async () => false } as never,
			{ toPunyNullable: () => null, isKeyWordIncluded: () => false } as never,
			{ notifySystemWebhook: vi.fn() } as never,
			{ validateLocalUsername: () => true } as never,
			{ gen: () => 'account' } as never,
			{} as never,
			{ update: vi.fn() } as never,
			{ update: vi.fn() } as never,
		);
		const { account } = await service.signup({ username: 'newuser', passwordHash: 'hash' });
		expect(account.approved).toBe(approved);
	});
});
