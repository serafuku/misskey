/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { i18n } from '@/i18n.js';
import { MenuItem } from '@/types/menu.js';
import * as Misskey from 'misskey-js';
import * as os from '@/os.js';
import { misskeyApi } from './misskey-api.js';
import { NoteHistory } from 'misskey-js/entities.js';

export async function getNoteHistory(props: {
	note: Misskey.entities.Note;
}) {
	const cleanups = [] as (() => void)[];

	const history:NoteHistory[] = await misskeyApi('notes/history', { noteId: props.note.id });

	const menu: MenuItem[] = [{
		text: history[0].updatedAt
	}];

	const cleanup = () => {
		if (_DEV_) console.log('note menu cleanup', cleanups);
		for (const cl of cleanups) {
			cl();
		}
	};

	return menu;
}
