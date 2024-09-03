/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { In } from 'typeorm';
import { ModuleRef } from '@nestjs/core';
import { DI } from '@/di-symbols.js';
import type { Packed } from '@/misc/json-schema.js';
import { awaitAll } from '@/misc/prelude/await-all.js';
import type { MiUser } from '@/models/User.js';
import type { MiNote } from '@/models/Note.js';
import type { UsersRepository, NotesRepository, FollowingsRepository, PollsRepository, PollVotesRepository, NoteReactionsRepository, ChannelsRepository, NoteHistoryRepository } from '@/models/_.js';
import { bindThis } from '@/decorators.js';
import { DebounceLoader } from '@/misc/loader.js';
import { IdService } from '@/core/IdService.js';
import { NoteHistory } from '@/models/NoteHistory.js';
import type { OnModuleInit } from '@nestjs/common';
import type { CustomEmojiService } from '../CustomEmojiService.js';
import type { UserEntityService } from './UserEntityService.js';
import type { DriveFileEntityService } from './DriveFileEntityService.js';

@Injectable()
export class NoteHistoryEntityService implements OnModuleInit {
	private userEntityService: UserEntityService;
	private driveFileEntityService: DriveFileEntityService;
	private customEmojiService: CustomEmojiService;
	private idService: IdService;
	private noteLoader = new DebounceLoader(this.findNoteOrFail);

	constructor(
		private moduleRef: ModuleRef,

		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,

		@Inject(DI.notesRepository)
		private notesRepository: NotesRepository,

		@Inject(DI.noteHistoryRepository)
		private noteHistoryRepository: NoteHistoryRepository,

		@Inject(DI.followingsRepository)
		private followingsRepository: FollowingsRepository,

		//private userEntityService: UserEntityService,
		//private driveFileEntityService: DriveFileEntityService,
		//private customEmojiService: CustomEmojiService,
		//private reactionService: ReactionService,
	) {
	}

	onModuleInit() {
		this.userEntityService = this.moduleRef.get('UserEntityService');
		this.driveFileEntityService = this.moduleRef.get('DriveFileEntityService');
		this.customEmojiService = this.moduleRef.get('CustomEmojiService');
		this.idService = this.moduleRef.get('IdService');
	}

	@bindThis
	public async packAttachedFiles(fileIds: NoteHistory['fileIds'], packedFiles: Map<NoteHistory['fileIds'][number], Packed<'DriveFile'> | null>): Promise<Packed<'DriveFile'>[]> {
		const missingIds = [];
		for (const id of fileIds) {
			if (!packedFiles.has(id)) missingIds.push(id);
		}
		if (missingIds.length) {
			const additionalMap = await this.driveFileEntityService.packManyByIdsMap(missingIds);
			for (const [k, v] of additionalMap) {
				packedFiles.set(k, v);
			}
		}
		return fileIds.map(id => packedFiles.get(id)).filter(x => x != null);
	}

	@bindThis
	public async pack(
		src: NoteHistory['id'],
		host: MiNote['userHost'],
		options?: {
			_hint_?: {
				packedFiles: Map<NoteHistory['fileIds'][number], Packed<'DriveFile'> | null>;
			};
		},
	): Promise<Packed<'NoteHistory'>> {
		const note = await this.noteLoader.load(src);

		const text = note.text;
		const packedFiles = options?._hint_?.packedFiles;

		const packed: Packed<'NoteHistory'> = await awaitAll({
			id: note.id,
			noteId: note.noteId,
			updatedAt: note.updatedAt.toISOString(),
			userId: note.userId,
			text: text,
			visibility: note.visibility,
			visibleUserIds: note.visibility === 'specified' ? note.visibleUserIds : undefined,
			emojis: host != null ? this.customEmojiService.populateEmojis(note.emojis, host) : undefined,
			fileIds: note.fileIds,
			files: packedFiles != null ? this.packAttachedFiles(note.fileIds, packedFiles) : this.driveFileEntityService.packManyByIds(note.fileIds),
		});

		return packed;
	}

	@bindThis
	private findNoteOrFail(id: string): Promise<NoteHistory> {
		return this.noteHistoryRepository.findOneOrFail({
			where: { id },
			relations: ['user'],
		});
	}
}
