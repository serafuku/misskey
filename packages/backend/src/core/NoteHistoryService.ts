/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable, OnApplicationShutdown } from '@nestjs/common';
import { DataSource, LessThan, MoreThan } from 'typeorm';
import { MiNote } from '@/models/Note.js';
import Logger from '@/logger.js';
import { IdService } from '@/core/IdService.js';

import { DI } from '@/di-symbols.js';
import type { NoteHistoryRepository, UsersRepository } from '@/models/_.js';
import { bindThis } from '@/decorators.js';
import { NoteHistory } from '@/models/NoteHistory.js';
import { LoggerService } from './LoggerService.js';
import { AppLockService } from './AppLockService.js';

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

		private idService: IdService,

		private loggerService: LoggerService,
		private appLockService: AppLockService,

	) {
		this.logger = this.loggerService.getLogger('NoteHistorySerivce');
	}

	@bindThis
	public async recordHistory (
		newData: MiNote,
		originalNote: MiNote,
		options: Option,
	) {
		const unlock = await this.appLockService.getApLock(`record-note-history:${originalNote.id}`);

		try {
			const lastRecord = await this.noteHistoryRepository.findOne({ where: { noteId: originalNote.id }, order: { id: 'DESC' } });
			const lastRecord_createdAt = lastRecord?.updatedAt ?? this.idService.parse(originalNote.id).date;

			const history_data: NoteHistory = {
				id: this.idService.gen(new Date().getTime()),
				noteId: originalNote.id,
				createdAt: lastRecord_createdAt, // 기록할 내용이 만들어진 시간
				updatedAt: options.updatedAt ?? new Date(), //대체된 시간
				userId: originalNote.userId,
				fileIds: originalNote.fileIds,
				attachedFileTypes: originalNote.attachedFileTypes,
				emojis: originalNote.emojis,
				text: originalNote.text,
				visibility: originalNote.visibility,
				visibleUserIds: originalNote.visibleUserIds,
			};

			if (newData.text === originalNote.text && JSON.stringify(newData.fileIds) === JSON.stringify(originalNote.fileIds)) {
				this.logger.info(`Skip Record History (The two notes are the same): ${originalNote.id}`);
			} else if (lastRecord && lastRecord.text === newData.text && JSON.stringify(lastRecord.fileIds) === JSON.stringify(newData.fileIds)) {
				this.logger.info('Skip Record History (Already inserted)');
			} else {
				this.logger.info(`Record History for: ${originalNote.id}`);
				await this.noteHistoryRepository.insert(history_data);
			}
		} catch (e) {
			this.logger.error(`Note History record Error! ${e}`);
		} finally {
			unlock();
		}
	}

	@bindThis
	public async getHistory (
		note_id: MiNote['id'],
		limit: number,
		sinceId?: NoteHistory['id'],
		untilId?: NoteHistory['id'],
	): Promise<NoteHistory[] | null> {
		this.logger.info(`get history of note ${note_id}`);
		try {
			const history = await this.noteHistoryRepository.find({
				where: {
					noteId: note_id,
					...(sinceId ? { id: MoreThan(sinceId) } : {}),
					...(untilId ? { id: LessThan(untilId) } : {}),
				},
				take: limit,
				order: { id: 'DESC' },
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
