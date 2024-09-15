/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from "typeorm";
import { id } from "./util/id.js";
import { MiNote } from "./Note.js";
import { MiUser } from "./User.js";

@Entity()
export class NoteTimeBomb {
	@PrimaryColumn(id())
	public id: string;

	@Index()
	@PrimaryColumn(id())
	public noteId: MiNote['id'];

	@ManyToOne(type => MiNote, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public note?: MiNote | null;

	@Column('timestamp with time zone')
	public timeBombAt: Date;

	@Column(id())
	public userId: MiUser['id'];

	@ManyToOne(type => MiUser, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public user?: MiUser | null;
}
