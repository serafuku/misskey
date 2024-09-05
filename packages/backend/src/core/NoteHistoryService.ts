/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable, OnApplicationShutdown } from '@nestjs/common';
import { DataSource, MoreThan } from 'typeorm';
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
		optoins: Option,
	) {
		const history_data: NoteHistory = {
			id: this.idService.gen(optoins.updatedAt?.getTime()),
			noteId: originalNote.id,
			updatedAt: optoins.updatedAt ?? new Date(),
			userId: originalNote.userId,
			fileIds: originalNote.fileIds,
			attachedFileTypes: originalNote.attachedFileTypes,
			emojis: originalNote.emojis,
			text: originalNote.text,
			visibility: originalNote.visibility,
			visibleUserIds: originalNote.visibleUserIds,
		};

		const unlock = await this.appLockService.getApLock(`record-note-history:${originalNote.id}`);
		try {
			const lastRecord = await this.noteHistoryRepository.findOne({ where: { noteId: originalNote.id }, order: { id: 'DESC' } });
			if (newData.text === originalNote.text && JSON.stringify(newData.fileIds) === JSON.stringify(originalNote.fileIds)) {
				this.logger.info(`Skip Record History (The two notes are the same): ${originalNote.id}`);
			} else if (lastRecord && lastRecord.text === newData.text && JSON.stringify(newData.fileIds) === JSON.stringify(originalNote.fileIds)) {
				this.logger.info('Skip Record History (Already inserted)');
			} else {
				this.logger.info(`Record History: ${originalNote.id}`);
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
	): Promise<NoteHistory[] | null> {
		this.logger.info(`get history of note ${note_id}`);
		try {
			const history = await this.noteHistoryRepository.find({
				where: {
					noteId: note_id,
					...(sinceId ? { id: MoreThan(sinceId) } : {}) },
				take: limit,
				order: { id: 'ASC' },
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
