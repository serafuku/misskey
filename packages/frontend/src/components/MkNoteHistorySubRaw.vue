<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div>
	<div v-if="!collapsed">
		<CodeDiff
			:context="5"
			:hideHeader="true"
			:oldString="oldNote ? oldNote.text : null"
			:newString="newNote.text"
		/>
	</div>
	<span v-if="!collapsed && props.newNote.files && props.newNote.files.length > 0">
		<MkMediaList :mediaList="props.newNote.files"/>
	</span>
	<div :class="$style.showButton">
		<button v-if="collapsed" :class="$style.showMore" class="_button" @click="collapsed = false">
			<span :class="$style.showMoreLabel">{{ i18n.ts.fold }}</span>
		</button>
		<button v-else-if="!collapsed" :class="$style.showLess" class="_button" @click="collapsed = true">
			<span :class="$style.showLessLabel">{{ i18n.ts.unfold }}</span>
		</button>
	</div>
</div>
</template>

<script lang="ts" setup>
import { ref } from 'vue';
import { CodeDiff } from 'v-code-diff';
import * as Misskey from 'misskey-js';
import { i18n } from '@/i18n';
import MkMediaList from '@/components/MkMediaList.vue';

const collapsed = ref(true);
const props = defineProps<{
  oldNote: Misskey.entities.NoteHistory | null;
  newNote: Misskey.entities.NoteHistory;
}>();
</script>
<style lang="scss" module>

.showMore{
	width: 100%;
	position: sticky;
	bottom: calc(var(--stickyBottom, 0px) + 14px);
}

.showMoreLabel {
	display: inline-block;
	background: var(--popup);
	padding: 0.6em 8em;
	font-size: 0.8em;
	border-radius: 0.8em;
	box-shadow: 0 2px 6px rgb(0 0 0 / 20%);
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
	padding: 0.6em 8em;
	margin-top: 3em;
	font-size: 0.8em;
	border-radius: 0.8em;
	box-shadow: 0 2px 6px rgb(0 0 0 / 20%);
}
</style>
