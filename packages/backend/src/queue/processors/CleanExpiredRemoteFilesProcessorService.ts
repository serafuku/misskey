/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { IsNull, LessThan, MoreThan, Not } from 'typeorm';
import { DI } from '@/di-symbols.js';
import type { MiDriveFile, DriveFilesRepository, UsersRepository } from '@/models/_.js';
import type Logger from '@/logger.js';
import { DriveService } from '@/core/DriveService.js';
import { bindThis } from '@/decorators.js';
import { MetaService } from '@/core/MetaService.js';
import { ApPersonService } from '@/core/activitypub/models/ApPersonService.js';
import { MiRemoteUser } from '@/models/User.js';
import { QueueLoggerService } from '../QueueLoggerService.js';
import type * as Bull from 'bullmq';

@Injectable()
export class CleanExpiredRemoteFilesProcessorService {
	private logger: Logger;

	constructor(
		@Inject(DI.driveFilesRepository)
		private driveFilesRepository: DriveFilesRepository,

		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,

		private driveService: DriveService,
		private queueLoggerService: QueueLoggerService,
		private metaService: MetaService,
		private apPersonService: ApPersonService,
	) {
		this.logger = this.queueLoggerService.logger.createSubLogger('clean-expired-remote-files');
	}

	@bindThis
	private async updateUsers(userIds: Set<string | null>): Promise<void> {
		return new Promise((resolve, reject) => {
			userIds.forEach(async (userId) => {
				this.logger.debug(`update uid ${userId}`);
				try {
					if (!userId) return;
					const user = await this.usersRepository.findOneByOrFail({ id: userId }) as MiRemoteUser;
					await this.apPersonService.updatePerson(user.uri);
				} catch (err) {
					this.logger.debug(`user ${userId} updatePerson fail`);
				}
			});
			resolve();
		});
	}
	@bindThis
	public async process(): Promise<void> {
		const meta = await this.metaService.fetch();
		const cache_days = meta.objectStorageCacheDays;
		if (cache_days == null) {
			this.logger.debug('skip clean (disabled)');
			return;
		}
		this.logger.info('Clean expired remote files...');

		let deletedCount = 0;
		let cursor: MiDriveFile['id'] | null = null;

		const userIds = new Set<MiDriveFile['userId']>();
		const expireDate = new Date(Date.now() - (cache_days * 24 * 60 * 60 * 1000));
		while (true) {
			const files = await this.driveFilesRepository.find({
				where: {
					userHost: Not(IsNull()),
					cachedAt: LessThan(expireDate),
					isLink: false,
					...(cursor ? { id: MoreThan(cursor) } : {}),
				},
				take: 8,
				order: {
					id: 1,
				},
			});

			if (files.length === 0) {
				break;
			}

			cursor = files.at(-1)?.id ?? null;

			await Promise.all(files.map(file => this.driveService.deleteFileSync(file, true)));
			await Promise.all(files.map(file => {
				if (file.userId) {
					userIds.add(file.userId);
				}
			}));

			deletedCount += 8;
		}
		this.updateUsers(userIds);
		this.logger.succ(`${deletedCount} cached remote files has been deleted. ${JSON.stringify(userIds)}`);
	}
}
