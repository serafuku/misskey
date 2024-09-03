import { Entity, Index, JoinColumn, Column, PrimaryColumn, ManyToOne, OneToOne, OneToMany } from 'typeorm';
import { noteVisibilities } from '@/types.js';
import { id } from './util/id.js';
import { MiUser } from './User.js';
import { MiNote } from './Note.js';
import type { MiDriveFile } from './DriveFile.js';

@Entity()
export class NoteHistory {
	@PrimaryColumn(id())
	public id: string;

	@Index()
	@ManyToOne(type => MiNote, {
		onDelete: 'CASCADE',
	})
	@Column({
		...id(),
		nullable: false,
		comment: 'The target Note ID for history',
	})
	public noteId: MiNote['id'];

	@Column('timestamp with time zone')
	public updatedAt: Date;

	@ManyToOne(type => MiUser, {
		onDelete: 'CASCADE',
	})
	public userId: MiUser['id'];

	@Column({
		...id(),
		array: true, default: '{}',
	})
	public fileIds: MiDriveFile['id'][];

	@Column('varchar', {
		length: 256, array: true, default: '{}',
	})
	public attachedFileTypes: string[];

	@Column('varchar', {
		length: 128, array: true, default: '{}',
	})
	public emojis: string[];

	@Column('text', {
		nullable: true,
	})
	public text: string | null;

	@Column('enum', { enum: noteVisibilities })
	public visibility: typeof noteVisibilities[number];

	@Column({
		...id(),
		array: true, default: '{}',
	})
	public visibleUserIds: MiUser['id'][];
}
