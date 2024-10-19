<!--
SPDX-FileCopyrightText: syuilo and other misskey contributors
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<PageWithHeader :actions="headerActions" :tabs="headerTabs">
	<div class="_spacer" style="--MI_SPACER-w: 900px;">
		<div class="_gaps_m">
			<!-- <MkPagination ref="paginationComponent" :pagination="pagination"> -->
			<MkPagination v-slot="{items}" :paginator="paginator">
				<div class="_gaps_s">
					<MkApprovalUser v-for="item in items" :key="item.id" :user="item" :onDeleted="deleted"/>
				</div>
			</MkPagination>
		</div>
	</div>
</PageWithHeader>
</template>

<script lang="ts" setup>
import { computed, markRaw, ref, shallowRef } from 'vue';

import * as Misskey from 'misskey-js';
import MkPagination from '@/components/MkPagination.vue';
import MkApprovalUser from '@/components/MkApprovalUser.vue';
import { i18n } from '@/i18n.js';
import { definePage } from '@/page.js';
import { Paginator } from '@/utility/paginator';
import { misskeyApi } from '@/utility/misskey-api';

const currentAwaitingApprovalUser = ref<Misskey.entities.UserDetailed[] | null>(null);

const paginator = markRaw(new Paginator('admin/show-users', {
	limit: 10,
	offsetMode: true,
	computedParams: computed(() => ({
		sort: '+createdAt',
		state: 'pending',
		origin: 'local',
	})),
}));

function deleted(id: string) {
	paginator.removeItem(id);
	update();
}

async function update() {
	currentAwaitingApprovalUser.value = await misskeyApi('admin/show-users');
}

const headerActions = computed(() => []);

const headerTabs = computed(() => []);

definePage(computed(() => ({
	title: i18n.ts.signupPendingApprovals,
	icon: 'ti ti-user-check',
})));
</script>

<style lang="scss" module>
.inputs {
	display: flex;
	gap: 8px;
	flex-wrap: wrap;
}

.input {
	flex: 1;
}
</style>
