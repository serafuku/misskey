/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { DI } from "@/di-symbols.js";
import Logger from "@/logger.js";
import type { MiNote, NotesRepository } from "@/models/_.js";
import { Inject, Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";
import { LoggerService } from "./LoggerService.js";
import { bindThis } from "@/decorators.js";
import { NoteTimeBomb } from "@/models/NoteTimeBomb.js";

@Injectable()
export class NoteTimeBombService {
	private logger: Logger;
	constructor (
		@Inject(DI.db)
		private db: DataSource,

		@Inject(DI.notesRepository)
		private notesRepository: NotesRepository,

		private loggerService: LoggerService,
	) {
		this.logger = this.loggerService.getLogger('NoteTimeBombService');
	}

	@bindThis
	public async installTimeBomb(
		targetNote: MiNote,
		timeBombAt: NoteTimeBomb,
	) {
		try {

		} catch {

		}
	}
}
