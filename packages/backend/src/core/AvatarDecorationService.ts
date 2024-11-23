/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable, OnApplicationShutdown } from '@nestjs/common';
import * as Redis from 'ioredis';
import { IsNull } from 'typeorm';
import { UserDetailedNotMe } from 'misskey-js/entities.js';
import type { AvatarDecorationsRepository, InstancesRepository, UsersRepository, MiAvatarDecoration, MiUser } from '@/models/_.js';
import { IdService } from '@/core/IdService.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { DI } from '@/di-symbols.js';
import { bindThis } from '@/decorators.js';
import { MemorySingleCache } from '@/misc/cache.js';
import type { GlobalEvents } from '@/core/GlobalEventService.js';
import { ModerationLogService } from '@/core/ModerationLogService.js';
import { HttpRequestService } from '@/core/HttpRequestService.js';
import { appendQuery, query } from '@/misc/prelude/url.js';
import type { Config } from '@/config.js';

@Injectable()
export class AvatarDecorationService implements OnApplicationShutdown {
	public cache: MemorySingleCache<MiAvatarDecoration[]>;
	public cacheWithRemote: MemorySingleCache<MiAvatarDecoration[]>;

	constructor(
		@Inject(DI.config)
		private config: Config,

		@Inject(DI.redisForSub)
		private redisForSub: Redis.Redis,

		@Inject(DI.avatarDecorationsRepository)
		private avatarDecorationsRepository: AvatarDecorationsRepository,

		@Inject(DI.instancesRepository)
		private instancesRepository: InstancesRepository,

		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,

		private idService: IdService,
		private moderationLogService: ModerationLogService,
		private globalEventService: GlobalEventService,
		private httpRequestService: HttpRequestService,
	) {
		this.cache = new MemorySingleCache<MiAvatarDecoration[]>(1000 * 60 * 30); // 30s
		this.cacheWithRemote = new MemorySingleCache<MiAvatarDecoration[]>(1000 * 60 * 30);

		this.redisForSub.on('message', this.onMessage);
	}

	@bindThis
	private async onMessage(_: string, data: string): Promise<void> {
		const obj = JSON.parse(data);

		if (obj.channel === 'internal') {
			const { type, body } = obj.message as GlobalEvents['internal']['payload'];
			switch (type) {
				case 'avatarDecorationCreated':
				case 'avatarDecorationUpdated':
				case 'avatarDecorationDeleted': {
					this.cache.delete();
					break;
				}
				default:
					break;
			}
		}
	}

	@bindThis
	public async create(options: Partial<MiAvatarDecoration>, moderator?: MiUser): Promise<MiAvatarDecoration> {
		const created = await this.avatarDecorationsRepository.insertOne({
			id: this.idService.gen(),
			...options,
		});

		this.globalEventService.publishInternalEvent('avatarDecorationCreated', created);

		if (moderator) {
			this.moderationLogService.log(moderator, 'createAvatarDecoration', {
				avatarDecorationId: created.id,
				avatarDecoration: created,
			});
		}

		return created;
	}

	@bindThis
	public async update(id: MiAvatarDecoration['id'], params: Partial<MiAvatarDecoration>, moderator?: MiUser): Promise<void> {
		const avatarDecoration = await this.avatarDecorationsRepository.findOneByOrFail({ id });

		const date = new Date();
		await this.avatarDecorationsRepository.update(avatarDecoration.id, {
			updatedAt: date,
			...params,
		});

		const updated = await this.avatarDecorationsRepository.findOneByOrFail({ id: avatarDecoration.id });
		this.globalEventService.publishInternalEvent('avatarDecorationUpdated', updated);

		if (moderator) {
			this.moderationLogService.log(moderator, 'updateAvatarDecoration', {
				avatarDecorationId: avatarDecoration.id,
				before: avatarDecoration,
				after: updated,
			});
		}
	}

	@bindThis
	private getProxiedUrl(url: string, mode?: 'static' | 'avatar'): string {
		return appendQuery(
			`${this.config.mediaProxy}/${mode ?? 'image'}.webp`,
			query({
				url,
				...(mode ? { [mode]: '1' } : {}),
			}),
		);
	}

	@bindThis
	public async remoteUserUpdate(user: MiUser) {
		const userHost = user.host ?? '';
		const instance = await this.instancesRepository.findOneBy({ host: userHost });
		const userHostUrl = `https://${user.host}`;
		const showUserApiUrl = `${userHostUrl}/api/users/show`;

		if (instance?.softwareName !== 'misskey' && instance?.softwareName !== 'cherrypick') {
			return;
		}

		const res = await this.httpRequestService.send(showUserApiUrl, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ 'username': user.username }),
		});

		const userData = await res.json() as Partial<UserDetailedNotMe> | undefined;
		const userAvatarDecorations = userData?.avatarDecorations;

		if (!userAvatarDecorations || userAvatarDecorations.length === 0) {
			const updates = {} as Partial<MiUser>;
			updates.avatarDecorations = [];
			await this.usersRepository.update({ id: user.id }, updates);
			return;
		}

		const instanceHost = instance.host;
		const decorationApiUrl = `https://${instanceHost}/api/get-avatar-decorations`;
		const allRes = await this.httpRequestService.send(decorationApiUrl, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({}),
		});
		const remoteDecorations = (await allRes.json() as Partial<MiAvatarDecoration[]> | undefined) ?? [];
		const updates = {} as Partial<MiUser>;
		updates.avatarDecorations = [];
		for (const userAvatarDecoration of userAvatarDecorations) {
			let name;
			let description;
			const userAvatarDecorationId = userAvatarDecoration.id;
			for (const remoteDecoration of remoteDecorations) {
				if (remoteDecoration?.id === userAvatarDecorationId) {
					name = remoteDecoration.name;
					description = remoteDecoration.description;
					break;
				}
			}
			const existingDecoration = await this.avatarDecorationsRepository.findOneBy({
				host: userHost,
				remoteId: userAvatarDecorationId,
			});
			const decorationData = {
				name: name,
				description: description,
				url: this.getProxiedUrl(userAvatarDecoration.url),
				remoteId: userAvatarDecorationId,
				host: userHost,
			};
			if (existingDecoration == null) {
				await this.create(decorationData);
				this.cacheWithRemote.delete();
			} else {
				await this.update(existingDecoration.id, decorationData);
				this.cacheWithRemote.delete();
			}
			const findDecoration = await this.avatarDecorationsRepository.findOneBy({
				host: userHost,
				remoteId: userAvatarDecorationId,
			});

			updates.avatarDecorations.push({
				id: findDecoration?.id ?? '',
				angle: userAvatarDecoration.angle ?? 0,
				flipH: userAvatarDecoration.flipH ?? false,
				offsetX: userAvatarDecoration.offsetX ?? 0,
				offsetY: userAvatarDecoration.offsetY ?? 0,
			});
		}
		await this.usersRepository.update({ id: user.id }, updates);
	}

	@bindThis
	public async delete(id: MiAvatarDecoration['id'], moderator?: MiUser): Promise<void> {
		const avatarDecoration = await this.avatarDecorationsRepository.findOneByOrFail({ id });

		await this.avatarDecorationsRepository.delete({ id: avatarDecoration.id });
		this.globalEventService.publishInternalEvent('avatarDecorationDeleted', avatarDecoration);

		if (moderator) {
			this.moderationLogService.log(moderator, 'deleteAvatarDecoration', {
				avatarDecorationId: avatarDecoration.id,
				avatarDecoration: avatarDecoration,
			});
		}
	}

	@bindThis
	public async getAll(noCache = false, withRemote = false): Promise<MiAvatarDecoration[]> {
		if (noCache) {
			this.cache.delete();
			this.cacheWithRemote.delete();
		}
		if (!withRemote) {
			return this.cache.fetch(() => this.avatarDecorationsRepository.find({ where: { host: IsNull() } }));
		} else {
			return this.cacheWithRemote.fetch(() => this.avatarDecorationsRepository.find());
		}
	}

	@bindThis
	public dispose(): void {
		this.redisForSub.off('message', this.onMessage);
	}

	@bindThis
	public onApplicationShutdown(signal?: string | undefined): void {
		this.dispose();
	}
}
