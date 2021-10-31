<script>
    import { comp } from "./stores.js";
    let toss, choice, win, myChoice, computerChoice;
	const chooseHead = () => {
		choice = 0;
	}

	const chooseTail = () => {
		choice = 1;
	}

	const tossCoin = () => {
		toss = Math.floor(Math.random()*2);
		win = (toss == choice);
	}

    const chooseBat = () => {
        myChoice = 0;
    }

    const chooseBowl = () => {
        myChoice = 1;
    }

    const loseToss = () => {
        computerChoice = Math.floor(Math.random()*2);
    }

    const nexty = () => {
        if (myChoice == 0 || computerChoice == 1) comp.set(1);
        else if (myChoice == 1 || computerChoice == 0) comp.set(2);
    }
</script>

<main>
    <h2>Choose Heads or Tails</h2>
    <button class="coin" on:click={chooseHead}>Heads</button>
    <button class="coin" on:click={chooseTail}>Tails</button>
    
    {#if choice == 0}
        <h2>You have chosen Heads</h2>
    {:else if choice == 1}
        <h2>You have chosen Tails</h2>
    {/if}

    {#if choice == 0 || choice == 1}
        <button class="try" on:click={tossCoin}>Toss Coin</button>
    {/if}

    {#if win == 1}
        <h2>You have won the toss!</h2>
        <h2>What do you choose to do?</h2>
        <button class="decision" on:click={chooseBat}>I'm gonna bat!</button>
        <button class="decision" on:click={chooseBowl}>I'm gonna bowl!</button>
    {:else if win == 0}
        <h2>You have lost the toss.</h2>
        <button class="choice" on:click={loseToss}>Reveal Computer's Choice</button>
    {/if}

    {#if myChoice == 0}
        <p>You have chosen to bat.</p>
    {:else if myChoice == 1}
        <p>You have chosen to bowl.</p>
    {/if}

    {#if computerChoice == 0}
        <p>Computer has chosen to bat.</p>
    {:else if computerChoice == 1}
        <p>Computer has chosen to bowl.</p>
    {/if}
    
    {#if myChoice == 0 || myChoice == 1 || computerChoice == 0 || computerChoice == 1}
        <button on:click={nexty}>Continue</button>
    {/if}
</main>

<style>
	button {
		border-radius: 5px;
		margin: 5px;
		border: 2px solid black;
	}

    .coin {
        background-color: yellow;
    }

    .try {
		background-color: greenyellow;
	}

    .choice {
        background-color: royalblue;
        color: white;
    }

    .decision {
        background-color: tomato;
        color: white;
    }
</style>