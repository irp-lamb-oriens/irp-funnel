<script lang="ts">
	import Page from '../../../wrappers/Page/Page.svelte';
	import MarkdownText from '../../../texts/MarkdownText/MarkdownText.svelte';

	export let canReveal = false;
</script>

<Page>
	<div class="gap">
		<MarkdownText {canReveal}>
			## **Here you** schedule the call with us.
		</MarkdownText>
	</div>
	<div class="spacing">
		<iframe width='100%' height='750px' src='https://zohodev-internationalrelocationpartner39.zohobookings.com/portal-embed#/internationalrelocationpartner' frameborder={0} allowfullscreen={true} > </iframe>
	</div>
</Page>


<style>
	.spacing {
		padding: 25px 0;
		background: #f7f8fc;
		width: 100vw;
	}

	.gap {
		display: grid;
		grid-gap: 25px;
		max-width: 1024px;
		margin: auto;
		
		@media (max-width: 1024px) {
			padding: 25px;
		}
	}
</style>
