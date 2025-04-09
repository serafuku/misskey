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
	@Column(id())
	public noteId: MiNote['id'];

	@ManyToOne(type => MiNote, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public note?: MiNote | null;

	/** 내용을 백업할 노트가 만들어졌던 시간 */
	@Column('timestamp with time zone')
	public createdAt: Date;

	/** 새로운 내용으로 대체된 시간 (이 히스토리가 기록된 시간) */
	@Column('timestamp with time zone')
	public updatedAt: Date;

	@Column(id())
	public userId: MiUser['id'];

	@ManyToOne(type => MiUser, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public user?: MiUser | null;

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
