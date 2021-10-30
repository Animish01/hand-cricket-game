<script>
	import { comp } from "./stores.js";
	import Toss from "./Toss.svelte";
	import UserBattingFirst from "./UserBattingFirst.svelte";
	import ComputerBattingFirst from "./ComputerBattingFirst.svelte";
	import UserBattingSecond from "./UserBattingSecond.svelte";
	import ComputerBattingSecond from "./ComputerBattingSecond.svelte";
	let toggle = 0;

	comp.subscribe(value => {
		toggle = value;
	});
</script>

<main>
	<h2>Welcome to</h2>
	<h1>Hand Cricket!</h1>
	{#if toggle == 0}
		<Toss/>
	{/if}
	{#if toggle == 1}
		<UserBattingFirst/>
	{/if}
	{#if toggle == 2}
		<ComputerBattingFirst/>
	{/if}
	{#if toggle == 3}
		<UserBattingSecond/>
	{/if}
	{#if toggle == 4}
		<ComputerBattingSecond/>
	{/if}
</main>

<style>
	main {
		text-align: center;
		padding: 1em;
		margin: 0 auto;
	}

	h1 {
		color: #ff3e00;
		text-transform: uppercase;
		font-size: 2.5em;
		font-weight: 100;
	}

	h2 {
		font-size: 2em;
	}
</style>