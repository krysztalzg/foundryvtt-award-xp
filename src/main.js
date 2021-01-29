"use strict";

import {registerSettings} from "./settings.js"
import {getSecondaryFormula, getSecondaryName, preparePcData} from "./systems.js"
import {getPcs} from "./util.js";


Hooks.once("init", () => {
	registerSettings()
})

Hooks.on("renderActorDirectory", async (actor_directory, html, data) => {
	const awardButton = $(`<button><i class="fas fa-angle-double-up"></i>${game.i18n.localize("award-xp.award-xp")}</button>`)
	html.find(".directory-footer").append(awardButton)
	awardButton.click((event) => {
		showAwardDialog()
	})
})

function filterCharacters(pc) {
	const characterFilter = game.settings.get("award-xp", "character-filter")
	const isInFilter = characterFilter.includes(pc.id)
	if (game.settings.get("award-xp", "character-filter-is-blacklist"))
		return !isInFilter
	else
		return isInFilter
}

async function showAwardDialog() {
	if (!game.user.isGM)
		return
	const secondaryFormula = getSecondaryFormula()
	let secondaryName = undefined
	if (secondaryFormula)
		secondaryName = getSecondaryName() ?? "[secondary name missing]"

	const characters = getPcs().filter(filterCharacters)
	const data = {secondaryName, characters}
	const content = await renderTemplate("modules/award-xp/templates/award_experience_dialog.html", data)
	Dialog.prompt({
		content: content,
		label: game.i18n.localize("award-xp.award-xp"),
		render: onAwardDialogRendered,
		callback: awardXP,
		options: {
			width: game.settings.get("award-xp", "character-solo-xp-input") ? 300 : 250,
			jQuery: true,
		},
	})
}

function onAwardDialogRendered(html) {
	html.find("#award-xp-secondary-xp").keyup(onSecondaryChange)
}

function awardXP(html) {
	html = html[0]
	let charIds = Array.from(html.querySelectorAll(".award-xp-char-selector")).filter(selector => selector.checked).map(selector => selector.name)
	if (charIds.length === 0) {
		throw game.i18n.localize("award-xp.no-char-selected")
	}
	const pcs = preparePcData(game.actors.filter(actor => charIds.includes(actor.id)))
	const groupXp = parseInt(html.querySelector("#award-xp-xp").value)
	if (isNaN(groupXp)) {
		throw game.i18n.localize("award-xp.xp-nan")
	}

	const charXp = Math.floor(groupXp / pcs.length)
	var soloXpMessages = {};
	pcs.forEach(pc => {
		var soloXp = 0;
		soloXpMessages[pc.actor.id] = '';
		if (game.settings.get("award-xp", "character-solo-xp-input")) {
			var soloXp = Array.from(html.querySelectorAll(".award-xp-solo")).filter(input => input.name == "xp" + pc.actor.id).map(input => parseInt(input.value)).map(value => isNaN(value) ? 0 : value)[0];
			soloXpMessages[pc.actor.id] = ' (+' + soloXp + ' bonus xp)';
		}
		pc.newXp = pc.xp + charXp + soloXp
		const updateData = {}
		updateData[pc.xpAttribute] = pc.newXp
		pc.actor.update(updateData)
	})

	renderAwardedMessage(charXp, pcs, soloXpMessages)
}

async function renderAwardedMessage(charXp, pcs, soloXpMessages) {
	let message = {}
	message.content = await renderTemplate("modules/award-xp/templates/awarded_experience_message.html", {xp: charXp, characters: pcs.map(pc => pc.actor.name + soloXpMessages[pc.actor.id])})
	ChatMessage.create(message)

	const levelups = pcs.filter(pc => pc.newXp >= pc.nextLevelXp)
	if (levelups.length > 0) {
		let message = {}
		message.content = await renderTemplate("modules/award-xp/templates/levelup_message.html", {characters: levelups.map(pc => pc.actor.name)})
		ChatMessage.create(message)
	}
}

function onSecondaryChange(event) {
	const secondaryValue = event.target.value.trim()
	const formula = getSecondaryFormula()
	const entry = formula.find(entry => secondaryValue == entry[0])
	if (entry) {
		const xp = entry[1]
		document.querySelector("#award-xp-xp").value = xp
	}
}
