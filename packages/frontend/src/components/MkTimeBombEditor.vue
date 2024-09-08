<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
	<div :class="$style.root">
		<MkSelect v-model="expiration" small>
			<template #label>{{ i18n.ts._timeBomb.expiration }}</template>
			<option value="infinite">{{ i18n.ts._timeBomb.infinite }}</option>
			<option value="at">{{ i18n.ts._timeBomb.at }}</option>
			<option value="after">{{ i18n.ts._timeBomb.after }}</option>
		</MkSelect>
		<section v-if="expiration === 'at'">
			<MkInput v-model="atDate" small type="date" class="input">
				<template #label>{{ i18n.ts._timeBomb.deadlineDate }}</template>
			</MkInput>
			<MkInput v-model="atTime" small type="time" class="input">
				<template #label>{{ i18n.ts._timeBomb.deadlineTime }}</template>
			</MkInput>
		</section>
		<section v-else-if="expiration === 'after'">
			<MkInput v-model="after" small type="number" min="1" class="input">
				<template #label>{{ i18n.ts._timeBomb.duration }}</template>
			</MkInput>
			<MkSelect v-model="unit" small>
				<option value="second">{{ i18n.ts._time.second }}</option>
				<option value="minute">{{ i18n.ts._time.minute }}</option>
				<option value="hour">{{ i18n.ts._time.hour }}</option>
				<option value="day">{{ i18n.ts._time.day }}</option>
			</MkSelect>
		</section>
	</div>
</template>

<script setup lang="ts">
import { i18n } from '@/i18n';
import MkInput from './MkInput.vue';
import MkSelect from './MkSelect.vue';
import { ref, watch } from 'vue';
import { formatDateTimeString } from '@/scripts/format-time-string';
import { addTime } from '@/scripts/time';

export type timeBombValue = {
	timeBombAt: number | null;
	timeBombAfter: number | null;
}

const props = defineProps<{
	modelValue: timeBombValue;
}>()
const emit = defineEmits<{
	(ev: 'update:modelValue', v: timeBombValue): void;
}>();

const expiration = ref('infinite');
const atDate = ref(formatDateTimeString(addTime(new Date(), 1, 'day'), 'yyyy-MM-dd'));
const atTime = ref('00:00');
const after = ref(0);
const unit = ref('second');

if (props.modelValue.timeBombAt) {
	expiration.value = 'at';
	const timeBombAt = new Date(props.modelValue.timeBombAt);
	atDate.value = formatDateTimeString(timeBombAt, 'yyyy-MM-dd');
	atTime.value = formatDateTimeString(timeBombAt, 'HH:mm');
} else if (typeof props.modelValue.timeBombAfter === 'number') {
	expiration.value = 'after';
	after.value = props.modelValue.timeBombAfter / 1000;
} else {
	expiration.value = 'infinite';
}

function get(): timeBombValue {
	const calcAt = () => {
		return new Date(`${atDate.value} ${atTime.value}`).getTime();
	};

	const calcAfter = () => {
		let base = parseInt(after.value.toString());
		switch (unit.value) {
			// @ts-expect-error fallthrough
			case 'day': base *= 24;
			// @ts-expect-error fallthrough
			case 'hour': base *= 60;
			// @ts-expect-error fallthrough
			case 'minute': base *= 60;
			// eslint-disable-next-line no-fallthrough
			case 'second': return base *= 1000;
			default: return null;
		}
	};

	return {
		timeBombAt: expiration.value === 'at' ? calcAt() : null,
		timeBombAfter: expiration.value === 'after' ? calcAfter() : null,
	};
}

watch([expiration, atDate, atTime, after, unit], () => emit('update:modelValue', get()), {
	deep: true,
});
</script>
<style lang="css" module>
	.root {
		padding: 8px 16px;

		> section {
			padding-top: 8px;
		}
	}
</style>
