/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { onUnmounted, reactive } from 'vue';
import * as Misskey from 'misskey-js';
import { EventEmitter } from 'eventemitter3';
import type { Reactive } from 'vue';
import { useStream } from '@/stream.js';
import { $i } from '@/i.js';
import { store } from '@/store.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { prefer } from '@/preferences.js';
import { globalEvents } from '@/events.js';

export const noteEvents = new EventEmitter<{
	[ev: `reacted:${string}`]: (ctx: {
		userId: Misskey.entities.User['id'];
		reaction: string;
		emoji?: { name: string; url: string };
	}) => void;
	[ev: `unreacted:${string}`]: (ctx: {
		userId: Misskey.entities.User['id'];
		reaction: string;
		emoji?: { name: string; url: string };
	}) => void;
	[ev: `pollVoted:${string}`]: (ctx: {
		userId: Misskey.entities.User['id'];
		choice: string;
	}) => void;
	[ev: `noteUpdated:${string}`]: (ctx: {
		text: Misskey.entities.Note['text'];
		files: Misskey.entities.Note['files'];
		cw: Misskey.entities.Note['cw'];
		poll: Misskey.entities.Note['poll'];
		updatedAt: Misskey.entities.Note['updatedAt'];
	}) => void;
}>();

const fetchEvent = new EventEmitter<{
	[id: string]: Pick<Misskey.entities.Note, 'reactions' | 'reactionEmojis'>;
}>();

const pollingQueue = new Map<
	string,
	{
		referenceCount: number;
		lastAddedAt: number;
	}
>();

function pollingEnqueue(note: Pick<Misskey.entities.Note, 'id' | 'createdAt'>) {
	if (pollingQueue.has(note.id)) {
		const data = pollingQueue.get(note.id)!;
		pollingQueue.set(note.id, {
			...data,
			referenceCount: data.referenceCount + 1,
			lastAddedAt: Date.now(),
		});
	} else {
		pollingQueue.set(note.id, {
			referenceCount: 1,
			lastAddedAt: Date.now(),
		});
	}
}

function pollingDequeue(note: Pick<Misskey.entities.Note, 'id' | 'createdAt'>) {
	const data = pollingQueue.get(note.id);
	if (data == null) return;

	if (data.referenceCount === 1) {
		pollingQueue.delete(note.id);
	} else {
		pollingQueue.set(note.id, {
			...data,
			referenceCount: data.referenceCount - 1,
		});
	}
}

const CAPTURE_MAX = 30;
const MIN_POLLING_INTERVAL = 1000 * 10;
const POLLING_INTERVAL =
	prefer.s.pollingInterval === 1
		? MIN_POLLING_INTERVAL * 1.5 * 1.5
		: prefer.s.pollingInterval === 2
			? MIN_POLLING_INTERVAL * 1.5
			: prefer.s.pollingInterval === 3
				? MIN_POLLING_INTERVAL
				: MIN_POLLING_INTERVAL;

window.setInterval(() => {
	const ids = [...pollingQueue.entries()]
		.filter(([k, v]) => Date.now() - v.lastAddedAt < 1000 * 60 * 180) // 追加されてから一定時間経過したものは省く
		.map(([k, v]) => k)
		.sort((a, b) => (a > b ? -1 : 1)) // 新しいものを優先するためにIDで降順ソート
		.slice(0, CAPTURE_MAX);

	if (ids.length === 0) return;
	if (window.document.hidden) return;

	// まとめてリクエストするのではなく、個別にHTTPリクエスト投げてCDNにキャッシュさせた方がサーバーの負荷低減には良いかもしれない？
	misskeyApi('notes/show-partial-bulk', {
		noteIds: ids,
	}).then((items) => {
		for (const item of items) {
			fetchEvent.emit(item.id, {
				reactions: item.reactions,
				reactionEmojis: item.reactionEmojis,
			});
		}
	});
}, POLLING_INTERVAL);

function pollingSubscribe(props: {
	note: Pick<Misskey.entities.Note, 'id' | 'createdAt'>;
	$note: ReactiveNoteData;
}) {
	const { note, $note } = props;

	function onFetched(
		data: Pick<Misskey.entities.Note, 'reactions' | 'reactionEmojis'>,
	): void {
		$note.reactions = data.reactions;
		$note.reactionCount = Object.values(data.reactions).reduce(
			(a, b) => a + b,
			0,
		);
		$note.reactionEmojis = data.reactionEmojis;
	}

	pollingEnqueue(note);
	fetchEvent.on(note.id, onFetched);

	onUnmounted(() => {
		pollingDequeue(note);
		fetchEvent.off(note.id, onFetched);
	});
}

function realtimeSubscribe(props: {
	note: Pick<Misskey.entities.Note, 'id' | 'createdAt'>;
}): void {
	const note = props.note;
	const connection = useStream();

	function onStreamNoteUpdated(noteData): void {
		const { type, id, body } = noteData;

		if (id !== note.id) return;

		switch (type) {
			case 'reacted': {
				noteEvents.emit(`reacted:${id}`, {
					userId: body.userId,
					reaction: body.reaction,
					emoji: body.emoji,
				});
				break;
			}

			case 'unreacted': {
				noteEvents.emit(`unreacted:${id}`, {
					userId: body.userId,
					reaction: body.reaction,
					emoji: body.emoji,
				});
				break;
			}

			case 'pollVoted': {
				noteEvents.emit(`pollVoted:${id}`, {
					userId: body.userId,
					choice: body.choice,
				});
				break;
			}

			case 'deleted': {
				globalEvents.emit('noteDeleted', id);
				break;
			}

			case 'updated': {
				noteEvents.emit(`noteUpdated:${id}`, {
					cw: body.cw,
					text: body.text,
					files: body.files,
					poll: body.poll,
					updatedAt: new Date(Date.now()).toString(),
				});
				break;
			}
		}
	}

	function capture(withHandler = false): void {
		connection.send('sr', { id: note.id });
		if (withHandler) connection.on('noteUpdated', onStreamNoteUpdated);
	}

	function decapture(withHandler = false): void {
		connection.send('un', { id: note.id });
		if (withHandler) connection.off('noteUpdated', onStreamNoteUpdated);
	}

	function onStreamConnected() {
		capture(false);
	}

	capture(true);
	connection.on('_connected_', onStreamConnected);

	onUnmounted(() => {
		decapture(true);
		connection.off('_connected_', onStreamConnected);
	});
}

export type ReactiveNoteData = {
	reactions: Misskey.entities.Note['reactions'];
	reactionCount: Misskey.entities.Note['reactionCount'];
	reactionEmojis: Misskey.entities.Note['reactionEmojis'];
	myReaction: Misskey.entities.Note['myReaction'];
	pollChoices: NonNullable<Misskey.entities.Note['poll']>['choices'];

	text: Misskey.entities.Note['text'];
	files: Misskey.entities.Note['files'];
	cw: Misskey.entities.Note['cw'];
	poll: Misskey.entities.Note['poll'];
	updatedAt: Misskey.entities.Note['updatedAt'];
};

const noReaction = Symbol();

export function useNoteCapture(props: {
	note: Misskey.entities.Note;
	parentNote: Misskey.entities.Note | null;
	mock?: boolean;
}): {
		$note: Reactive<ReactiveNoteData>;
		subscribe: () => void;
	} {
	const { note, parentNote, mock } = props;

	const $note = reactive<ReactiveNoteData>({
		reactions: Object.entries(note.reactions).reduce(
			(acc, [name, count]) => {
				// Normalize reactions
				const normalizedName = name.replace(/^:(\w+):$/, ':$1@.:');
				if (acc[normalizedName] == null) {
					acc[normalizedName] = count;
				} else {
					acc[normalizedName] += count;
				}
				return acc;
			},
			{} as Misskey.entities.Note['reactions'],
		),
		reactionCount: note.reactionCount,
		reactionEmojis: note.reactionEmojis,
		myReaction: note.myReaction,
		pollChoices: note.poll?.choices ?? [],

		cw: note.cw ?? null,
		text: note.text ?? '',
		files: note.files ?? undefined,
		poll: note.poll ?? null,
		updatedAt: note.updatedAt ?? null,
	});

	noteEvents.on(`reacted:${note.id}`, onReacted);
	noteEvents.on(`unreacted:${note.id}`, onUnreacted);
	noteEvents.on(`pollVoted:${note.id}`, onPollVoted);
	noteEvents.on(`noteUpdated:${note.id}`, onUpdated);

	// 操作がダブっていないかどうかを簡易的に記録するためのMap
	const reactionUserMap = new Map<
		Misskey.entities.User['id'],
		string | typeof noReaction
	>();
	let latestPollVotedKey: string | null = null;

	function onReacted(ctx: {
		userId: Misskey.entities.User['id'];
		reaction: string;
		emoji?: { name: string; url: string };
	}): void {
		let normalizedName = ctx.reaction.replace(/^:(\w+):$/, ':$1@.:');
		normalizedName = normalizedName.match('\u200d')
			? normalizedName
			: normalizedName.replace(/\ufe0f/g, '');
		if (
			reactionUserMap.has(ctx.userId) &&
			reactionUserMap.get(ctx.userId) === normalizedName
		) return;
		reactionUserMap.set(ctx.userId, normalizedName);

		if (ctx.emoji && !(ctx.emoji.name in $note.reactionEmojis)) {
			$note.reactionEmojis[ctx.emoji.name] = ctx.emoji.url;
		}

		const currentCount = $note.reactions[normalizedName] || 0;

		$note.reactions[normalizedName] = currentCount + 1;
		$note.reactionCount += 1;

		if ($i && ctx.userId === $i.id) {
			$note.myReaction = normalizedName;
		}
	}

	function onUnreacted(ctx: {
		userId: Misskey.entities.User['id'];
		reaction: string;
		emoji?: { name: string; url: string };
	}): void {
		let normalizedName = ctx.reaction.replace(/^:(\w+):$/, ':$1@.:');
		normalizedName = normalizedName.match('\u200d')
			? normalizedName
			: normalizedName.replace(/\ufe0f/g, '');

		// 確実に一度リアクションされて取り消されている場合のみ処理をとめる（APIで初回読み込み→Streamでアップデート等の場合、reactionUserMapに情報がないため）
		if (
			reactionUserMap.has(ctx.userId) &&
			reactionUserMap.get(ctx.userId) === noReaction
		) return;
		reactionUserMap.set(ctx.userId, noReaction);

		const currentCount = $note.reactions[normalizedName] || 0;

		$note.reactions[normalizedName] = Math.max(0, currentCount - 1);
		$note.reactionCount = Math.max(0, $note.reactionCount - 1);
		if ($note.reactions[normalizedName] === 0) delete $note.reactions[normalizedName];

		if ($i && ctx.userId === $i.id) {
			$note.myReaction = null;
		}
	}

	function onPollVoted(ctx: {
		userId: Misskey.entities.User['id'];
		choice: string;
	}): void {
		const newPollVotedKey = `${ctx.userId}:${ctx.choice}`;
		if (newPollVotedKey === latestPollVotedKey) return;
		latestPollVotedKey = newPollVotedKey;

		const choices = [...$note.pollChoices];
		choices[ctx.choice] = {
			...choices[ctx.choice],
			votes: choices[ctx.choice].votes + 1,
			...($i && ctx.userId === $i.id
				? {
					isVoted: true,
				}
				: {}),
		};

		$note.pollChoices = choices;
	}

	function onUpdated(ctx: {
		cw: Misskey.entities.Note['cw'];
		text: Misskey.entities.Note['text'];
		files: Misskey.entities.Note['files'];
		poll: Misskey.entities.Note['poll'];
		updatedAt: Misskey.entities.Note['updatedAt'];
	}): void {
		if (ctx.cw !== undefined) {
			$note.cw = note.cw = ctx.cw;
		}
		if (ctx.files !== undefined) {
			$note.files = note.files = ctx.files;
		}
		if (ctx.text !== undefined) {
			$note.text = note.text = ctx.text;
		}
		if (ctx.poll !== undefined) {
			$note.poll = note.poll = ctx.poll;
		}
		if (ctx.updatedAt !== undefined) {
			$note.updatedAt = note.updatedAt = ctx.updatedAt;
		}
	}

	function subscribe() {
		if (mock) {
			// モックモードでは購読しない
			return;
		}

		if ($i && store.s.realtimeMode) {
			realtimeSubscribe({
				note,
			});
		} else {
			pollingSubscribe({
				note,
				$note,
			});
		}
	}

	onUnmounted(() => {
		noteEvents.off(`reacted:${note.id}`, onReacted);
		noteEvents.off(`unreacted:${note.id}`, onUnreacted);
		noteEvents.off(`pollVoted:${note.id}`, onPollVoted);
		noteEvents.off(`noteUpdated:${note.id}`, onUpdated);
	});
	subscribe();
	return {
		$note,
		subscribe: () => {
			subscribe();
		},
	};
}
