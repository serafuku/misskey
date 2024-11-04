/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Injectable } from '@nestjs/common';
import type { Packed } from '@/misc/json-schema.js';
import { MetaService } from '@/core/MetaService.js';
import { NoteEntityService } from '@/core/entities/NoteEntityService.js';
import { bindThis } from '@/decorators.js';
import { RoleService } from '@/core/RoleService.js';
import { isRenotePacked, isQuotePacked } from '@/misc/is-renote.js';
import type { JsonObject } from '@/misc/json-value.js';
import Channel, { type MiChannelService } from '../channel.js';

class AdminAllNoteChannel extends Channel {
	public readonly chName = '__adminAllNote';
	public static shouldShare = true;
	public static requireCredential = true as const;
	public static kind = 'read:admin:stream';
	private withRenotes: boolean;
	private withFiles: boolean;

	constructor(
		private metaService: MetaService,
		private roleService: RoleService,
		private noteEntityService: NoteEntityService,

		id: string,
		connection: Channel['connection'],
	) {
		super(id, connection);
		//this.onNote = this.onNote.bind(this);
	}

	@bindThis
	public async init(params: JsonObject) {
		const policies = await this.roleService.getUserPolicies(this.user ? this.user.id : null);
		const isAdmin = await this.roleService.isAdministrator(this.user ?? null);
		if (!policies.gtlAvailable || !isAdmin) return;

		this.withRenotes = !!(params.withRenotes ?? true);
		this.withFiles = !!(params.withFiles ?? false);

		// Subscribe events
		this.subscriber.on('notesStream', this.onNote);
	}

	@bindThis
	private async onNote(note: Packed<'Note'>) {
		if (this.withFiles && (note.fileIds == null || note.fileIds.length === 0)) return;

		if (note.channelId != null) return;

		if (isRenotePacked(note) && !isQuotePacked(note) && !this.withRenotes) return;

		this.connection.cacheNote(note);

		this.send('note', note);
	}

	@bindThis
	public dispose() {
		// Unsubscribe events
		this.subscriber.off('notesStream', this.onNote);
	}
}

@Injectable()
export class AdminAllNoteChannelService implements MiChannelService<true> {
	public readonly shouldShare = AdminAllNoteChannel.shouldShare;
	public readonly requireCredential = AdminAllNoteChannel.requireCredential;
	public readonly kind = AdminAllNoteChannel.kind;

	constructor(
		private metaService: MetaService,
		private roleService: RoleService,
		private noteEntityService: NoteEntityService,
	) {
	}

	@bindThis
	public create(id: string, connection: Channel['connection']): AdminAllNoteChannel {
		return new AdminAllNoteChannel(
			this.metaService,
			this.roleService,
			this.noteEntityService,
			id,
			connection,
		);
	}
}
