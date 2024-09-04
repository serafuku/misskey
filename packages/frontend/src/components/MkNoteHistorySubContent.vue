<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div>
	<div>
		<span :class="$style.time">{{ i18n.ts.updatedAt }}: <MkTime :time="history.updatedAt" mode="detail"/>
		</span>
	</div>
	<div>
		<Mfm v-if="history.text && !collapsed" :text="history.text" :author="originalNote.user" :nyaize="'respect'" :emojiUrls="history.emojis"/>
	</div>
	<span v-if="props.history.files && props.history.files.length > 0 && !collapsed">
		<MkMediaList :mediaList="props.history.files"/>
	</span>
	<button v-if="collapsed" :class="$style.showMore" class="_button" @click="collapsed = false">
		<span :class="$style.showMoreLabel">{{ i18n.ts.showMore }}</span>
	</button>
	<button v-else-if="!collapsed" :class="$style.showLess" class="_button" @click="collapsed = true">
		<span :class="$style.showLessLabel">{{ i18n.ts.showLess }}</span>
	</button>
</div>
</template>

<script lang="ts" setup>
import { ref } from 'vue';
import * as Misskey from 'misskey-js';
import MkMediaList from '@/components/MkMediaList.vue';
import { i18n } from '@/i18n.js';

const props = defineProps<{
	history: Misskey.entities.NoteHistory;
	originalNote: Misskey.entities.Note;
}>();

const collapsed = ref(true);
</script>

<style lang="scss" module>

.showMoreLabel {
	display: inline-block;
	background: var(--popup);
	padding: 6px 10px;
	font-size: 0.8em;
	border-radius: 999px;
	box-shadow: 0 2px 6px rgb(0 0 0 / 20%);
}

.reply {
	margin-right: 6px;
	color: var(--accent);
}

.rp {
	margin-left: 4px;
	font-style: oblique;
	color: var(--renote);
}

.time {
	font-size: 0.8em;
	color: var(--accent);
}

.showMore{
	width: 100%;
	position: sticky;
	bottom: calc(var(--stickyBottom, 0px) + 14px);
}

.showLess {
	width: 100%;
	margin-top: 14px;
	position: sticky;
	bottom: calc(var(--stickyBottom, 0px) + 14px);
}

.showLessLabel {
	display: inline-block;
	background: var(--popup);
	padding: 6px 10px;
	font-size: 0.8em;
	border-radius: 999px;
	box-shadow: 0 2px 6px rgb(0 0 0 / 20%);
}

.name {
	flex-shrink: 1;
	display: block;
	margin: 0 .5em 0 0;
	padding: 0;
	overflow: hidden;
	font-size: 1em;
	font-weight: bold;
	text-decoration: none;
	text-overflow: ellipsis;

	&:hover {
		text-decoration: underline;
	}
}
</style>
