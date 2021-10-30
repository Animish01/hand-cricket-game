<script>
    import { comp, target } from "./stores.js";
	let score = 0;
	let comp_score = 0;
	let put_string = "";
	let lost_string = "";

    const rand1 = () => {
		comp_score = Math.floor(Math.random()*6)+1;
		put_string = "You have shown: 1";
		if (comp_score != 1) score += 1;
		else lost_string = "You are out :(";
	}
	const rand2 = () => {
		comp_score = Math.floor(Math.random()*6)+1;
		put_string = "You have shown: 2";
		if (comp_score != 2) score += 2;
        else lost_string = "You are out :(";
	}
	const rand3 = () => {
		comp_score = Math.floor(Math.random()*6)+1;
		put_string = "You have shown: 3";
		if (comp_score != 3) score += 3;
		else lost_string = "You are out :(";
	}
	const rand4 = () => {
		comp_score = Math.floor(Math.random()*6)+1;
		put_string = "You have shown: 4"; 
		if (comp_score != 4) score += 4;
		else lost_string = "You are out :(";
	}
	const rand5 = () => {
		comp_score = Math.floor(Math.random()*6)+1;
		put_string = "You have shown: 5";  
		if (comp_score != 5) score += 5;
		else lost_string = "You are out :(";
	}
	const rand6 = () => {
		comp_score = Math.floor(Math.random()*6)+1;
		put_string = "You have shown: 6";  
		if (comp_score != 6) score += 6;
		else lost_string = "You are out :(";
	}

    const nexty = () => {
        target.set(score + 1);
        comp.set(4);
    }
</script>

<main>
    <h2>You are batting</h2>
    <p class="compscore">Your score: {score}</p>
    {#if lost_string == ""}
        <p class="compscore1">Click a button to show a number</p>
        <button class="deal" on:click={rand1}>One</button>
        <button class="deal" on:click={rand2}>Two</button>
        <button class="deal" on:click={rand3}>Three</button>
        <button class="deal" on:click={rand4}>Four</button>
        <button class="deal" on:click={rand5}>Five</button>
        <button class="deal" on:click={rand6}>Six</button>
    {/if}
    <p class="compscore">{put_string}</p>
    <p class="compscore">Computer has shown: {comp_score}</p>
    <h2>{lost_string}</h2>
    {#if lost_string != ""}
        <p class="compscore1">Target for computer is {score + 1}</p>
        <button on:click={nexty}>Continue</button>
    {/if}
</main>

<style>
	main {
		text-align: center;
		padding: 1em;
		margin: 0 auto;
	}

	h2 {
		font-size: 2em;
	}

	button {
		border-radius: 5px;
		margin: 5px;
		border: 2px solid black;
	}

	.deal {
		background-color: turquoise;
	}

	.compscore {
		font-size: xx-large;
	}

	.compscore1 {
		font-size: x-large;
	}
</style>