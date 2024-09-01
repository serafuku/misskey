/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { setImmediate } from 'node:timers/promises';
import util from 'util';
import * as mfm from 'mfm-js';
import { Inject, Injectable, OnApplicationShutdown } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { node } from '@tensorflow/tfjs-node';
import type { IMentionedRemoteUsers } from '@/models/Note.js';
import { MiNote } from '@/models/Note.js';
import type { MiUser, MiLocalUser, MiRemoteUser } from '@/models/User.js';
import { RelayService } from '@/core/RelayService.js';
import ActiveUsersChart from '@/core/chart/charts/active-users.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { DriveFileEntityService } from '@/core/entities/DriveFileEntityService.js';
import { ApRendererService } from '@/core/activitypub/ApRendererService.js';
import { ApDeliverManagerService } from '@/core/activitypub/ApDeliverManagerService.js';
import { DB_MAX_NOTE_TEXT_LENGTH } from '@/const.js';
import { SearchService } from '@/core/SearchService.js';
import { normalizeForSearch } from '@/misc/normalize-for-search.js';
import { MiDriveFile, MiPollVote } from '@/models/_.js';
import { MiPoll, IPoll } from '@/models/Poll.js';
import { concat } from '@/misc/prelude/array.js';
import { extractHashtags } from '@/misc/extract-hashtags.js';
import { extractCustomEmojisFromMfm } from '@/misc/extract-custom-emojis-from-mfm.js';
import Logger from '@/logger.js';
import { IdService } from '@/core/IdService.js';

import { DI } from '@/di-symbols.js';
import type { NoteHistoryRepository, UsersRepository } from '@/models/_.js';
import { bindThis } from '@/decorators.js';
import { NoteHistory } from '@/models/NoteHistory.js';
import { LoggerService } from './LoggerService.js';
import { NoteEntityService } from './entities/NoteEntityService.js';

type Option = {
	updatedAt?: Date | null;
};

@Injectable()
export class NoteHistorySerivce implements OnApplicationShutdown {
	#shutdownController = new AbortController();
	private logger: Logger;
	constructor (
		@Inject(DI.db)
		private db: DataSource,

		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,

		@Inject(DI.noteHistoryRepository)
		private noteHistoryRepository: NoteHistoryRepository,

		private userEntityService: UserEntityService,
		private noteEntityService: NoteEntityService,
		private driveFileEntityService: DriveFileEntityService,
		private globalEventService: GlobalEventService,
		private relayService: RelayService,
		private apDeliverManagerService: ApDeliverManagerService,
		private apRendererService: ApRendererService,
		private searchService: SearchService,
		private activeUsersChart: ActiveUsersChart,
		private idService: IdService,

		private loggerService: LoggerService,
	) {
		this.logger = this.loggerService.getLogger('NoteHistorySerivce');
	}

	@bindThis
	public async record (
		note_id: MiNote['id'],
		note: MiNote,
		optoins: Option,
	) {
		this.logger.info(`Record Note History: ${note_id}`);
		const history_data: NoteHistory = {
			id: this.idService.gen(optoins.updatedAt?.getTime()),
			noteId: note.id,
			updatedAt: optoins.updatedAt ?? new Date(),
			userId: note.userId,
			fileIds: note.fileIds,
			attachedFileTypes: note.attachedFileTypes,
			emojis: note.emojis,
		};
		try {
			this.noteHistoryRepository.insert(history_data);
		} catch (e) {
			this.logger.error(`Note History record Error! ${e}`);
		}
	}

	@bindThis
	public async getHistory (
		note_id: MiNote['id'],
	): Promise<NoteHistory[] | null> {
		this.logger.info(`get history of note ${note_id}`);
		try {
			const history = await this.noteHistoryRepository.findBy({
				noteId: note_id,
			});
			if (history.length > 0) {
				return history;
			} else {
				return null;
			}
		} catch (e) {
			this.logger.error(`Note History find error: ${e}`);
			throw e;
		}
	}

	@bindThis
	public dispose(): void {
		this.#shutdownController.abort();
	}

	@bindThis
	public onApplicationShutdown(signal?: string | undefined): void {
		this.dispose();
	}
}
