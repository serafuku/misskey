<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div>
	<div>
		<CodeDiff
			:context="5"
			:hideHeader="true"
			:oldString="oldNote ? oldNote.text : null"
			:newString="newNote.text"
		/>
	</div>
	<span v-if="props.newNote.files && props.newNote.files.length > 0">
		<MkMediaList :mediaList="props.newNote.files"/>
	</span>
</div>
</template>

<script lang="ts" setup>
import { CodeDiff } from 'v-code-diff';
import * as Misskey from 'misskey-js';
import MkMediaList from '@/components/MkMediaList.vue';

const props = defineProps<{
  oldNote: Misskey.entities.NoteHistory | null;
  newNote: Misskey.entities.NoteHistory;
}>();
</script>
