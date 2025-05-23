<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<PageWithHeader :tabs="headerTabs">
	<div class="_spacer" style="--MI_SPACER-w: 700px; --MI_SPACER-min: 16px; --MI_SPACER-max: 32px;">
		<FormSuspense :p="init">
			<div class="_gaps_m">
				<MkSwitch v-model="useObjectStorage">{{ i18n.ts.useObjectStorage }}</MkSwitch>

				<template v-if="useObjectStorage">
					<MkInput v-model="objectStorageBaseUrl" :placeholder="'https://example.com'" type="url">
						<template #label>{{ i18n.ts.objectStorageBaseUrl }}</template>
						<template #caption>{{ i18n.ts.objectStorageBaseUrlDesc }}</template>
					</MkInput>

					<MkInput v-model="objectStorageBucket">
						<template #label>{{ i18n.ts.objectStorageBucket }}</template>
						<template #caption>{{ i18n.ts.objectStorageBucketDesc }}</template>
					</MkInput>

					<MkInput v-model="objectStoragePrefix">
						<template #label>{{ i18n.ts.objectStoragePrefix }}</template>
						<template #caption>{{ i18n.ts.objectStoragePrefixDesc }}</template>
					</MkInput>

					<MkInput v-model="objectStoragePrefixForRemote">
						<template #label>{{ i18n.ts.objectStoragePrefixForRemote }}</template>
						<template #caption>{{ i18n.ts.objectStoragePrefixForRemoteDesc }}</template>
					</MkInput>

					<MkInput v-model="objectStorageEndpoint" :placeholder="'example.com'">
						<template #label>{{ i18n.ts.objectStorageEndpoint }}</template>
						<template #prefix>https://</template>
						<template #caption>{{ i18n.ts.objectStorageEndpointDesc }}</template>
					</MkInput>

					<MkInput v-model="objectStorageRegion">
						<template #label>{{ i18n.ts.objectStorageRegion }}</template>
						<template #caption>{{ i18n.ts.objectStorageRegionDesc }}</template>
					</MkInput>

					<FormSplit :minWidth="280">
						<MkInput v-model="objectStorageAccessKey">
							<template #prefix><i class="ti ti-key"></i></template>
							<template #label>Access key</template>
						</MkInput>

						<MkInput v-model="objectStorageSecretKey" type="password">
							<template #prefix><i class="ti ti-key"></i></template>
							<template #label>Secret key</template>
						</MkInput>
					</FormSplit>

					<MkSwitch v-model="objectStorageUseSSL">
						<template #label>{{ i18n.ts.objectStorageUseSSL }}</template>
						<template #caption>{{ i18n.ts.objectStorageUseSSLDesc }}</template>
					</MkSwitch>

					<MkSwitch v-model="objectStorageUseProxy">
						<template #label>{{ i18n.ts.objectStorageUseProxy }}</template>
						<template #caption>{{ i18n.ts.objectStorageUseProxyDesc }}</template>
					</MkSwitch>

					<MkSwitch v-model="objectStorageSetPublicRead">
						<template #label>{{ i18n.ts.objectStorageSetPublicRead }}</template>
					</MkSwitch>

					<MkSwitch v-model="objectStorageS3ForcePathStyle">
						<template #label>s3ForcePathStyle</template>
						<template #caption>{{ i18n.ts.s3ForcePathStyleDesc }}</template>
					</MkSwitch>

					<MkInput v-model="objectStorageCacheDays">
						<template #label>{{ i18n.ts.objectStorageCacheDays }}</template>
						<template #caption>{{ i18n.ts.objectStorageCacheDaysDesc }}</template>
					</MkInput>
				</template>
			</div>
		</FormSuspense>
	</div>
	<template #footer>
		<div :class="$style.footer">
			<div class="_spacer" style="--MI_SPACER-w: 700px; --MI_SPACER-min: 16px; --MI_SPACER-max: 16px;">
				<MkButton primary rounded @click="save"><i class="ti ti-check"></i> {{ i18n.ts.save }}</MkButton>
			</div>
		</div>
	</template>
</PageWithHeader>
</template>

<script lang="ts" setup>
import { ref, computed } from 'vue';
import MkSwitch from '@/components/MkSwitch.vue';
import MkInput from '@/components/MkInput.vue';
import FormSuspense from '@/components/form/suspense.vue';
import FormSplit from '@/components/form/split.vue';
import * as os from '@/os.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { fetchInstance } from '@/instance.js';
import { i18n } from '@/i18n.js';
import { definePage } from '@/page.js';
import MkButton from '@/components/MkButton.vue';

const useObjectStorage = ref<boolean>(false);
const objectStorageBaseUrl = ref<string | null>(null);
const objectStorageBucket = ref<string | null>(null);
const objectStoragePrefix = ref<string | null>(null);
const objectStoragePrefixForRemote = ref<string | null>(null);
const objectStorageEndpoint = ref<string | null>(null);
const objectStorageRegion = ref<string | null>(null);
const objectStoragePort = ref<number | null>(null);
const objectStorageAccessKey = ref<string | null>(null);
const objectStorageSecretKey = ref<string | null>(null);
const objectStorageUseSSL = ref<boolean>(false);
const objectStorageUseProxy = ref<boolean>(false);
const objectStorageSetPublicRead = ref<boolean>(false);
const objectStorageS3ForcePathStyle = ref<boolean>(true);
const objectStorageCacheDays = ref<number | null>(null);

async function init() {
	const meta = await misskeyApi('admin/meta');
	useObjectStorage.value = meta.useObjectStorage;
	objectStorageBaseUrl.value = meta.objectStorageBaseUrl;
	objectStorageBucket.value = meta.objectStorageBucket;
	objectStoragePrefix.value = meta.objectStoragePrefix;
	objectStoragePrefixForRemote.value = meta.objectStoragePrefixForRemote;
	objectStorageEndpoint.value = meta.objectStorageEndpoint;
	objectStorageRegion.value = meta.objectStorageRegion;
	objectStoragePort.value = meta.objectStoragePort;
	objectStorageAccessKey.value = meta.objectStorageAccessKey;
	objectStorageSecretKey.value = meta.objectStorageSecretKey;
	objectStorageUseSSL.value = meta.objectStorageUseSSL;
	objectStorageUseProxy.value = meta.objectStorageUseProxy;
	objectStorageSetPublicRead.value = meta.objectStorageSetPublicRead;
	objectStorageS3ForcePathStyle.value = meta.objectStorageS3ForcePathStyle;
	objectStorageCacheDays.value = meta.objectStorageCacheDays;
}

function save() {
	os.apiWithDialog('admin/update-meta', {
		useObjectStorage: useObjectStorage.value,
		objectStorageBaseUrl: objectStorageBaseUrl.value,
		objectStorageBucket: objectStorageBucket.value,
		objectStoragePrefix: objectStoragePrefix.value,
		objectStoragePrefixForRemote: objectStoragePrefixForRemote.value,
		objectStorageEndpoint: objectStorageEndpoint.value,
		objectStorageRegion: objectStorageRegion.value,
		objectStoragePort: objectStoragePort.value,
		objectStorageAccessKey: objectStorageAccessKey.value,
		objectStorageSecretKey: objectStorageSecretKey.value,
		objectStorageUseSSL: objectStorageUseSSL.value,
		objectStorageUseProxy: objectStorageUseProxy.value,
		objectStorageSetPublicRead: objectStorageSetPublicRead.value,
		objectStorageS3ForcePathStyle: objectStorageS3ForcePathStyle.value,
		objectStorageCacheDays: Number(objectStorageCacheDays.value),
	}).then(() => {
		fetchInstance(true);
	});
}

const headerTabs = computed(() => []);

definePage(() => ({
	title: i18n.ts.objectStorage,
	icon: 'ti ti-cloud',
}));
</script>

<style lang="scss" module>
.footer {
	-webkit-backdrop-filter: var(--MI-blur, blur(15px));
	backdrop-filter: var(--MI-blur, blur(15px));
}
</style>
