<script lang="ts">
	import { goto } from '$app/navigation';
	import Page from '../../../wrappers/Page/Page.svelte';
	import MarkdownText from '../../../texts/MarkdownText/MarkdownText.svelte';
	import SubmitButton from '../../../buttons/SubmitButton/SubmitButton.svelte';

	export let canReveal = false;

	function openBookingForm() {
		goto(`/${window.location.search}#hero-form`);
	}
</script>

<Page>
	<div class="gap">
		<MarkdownText {canReveal}>
			## **Here you** schedule the call with us.
		</MarkdownText>
		<div class="center">
			<SubmitButton color="error" label="Book your call" callback={openBookingForm} />
		</div>
	</div>
</Page>

<style>
	.gap {
		display: grid;
		grid-gap: 25px;
		max-width: 1024px;
		margin: auto;

		@media (max-width: 1024px) {
			padding: 25px;
		}
	}

	.center {
		display: grid;
		justify-items: center;
	}
</style>
