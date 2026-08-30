export interface Chef {
	slug: string;
	name: string;
	role: string;
	note?: string;
}

export const kitchenName = "Maurice's non-technical friends";

export const chefs: Chef[] = [
	{ slug: 'claudia', name: 'Claudia', role: 'Head Chef', note: 'Above Maurice — runs the whole kitchen network' },
	{ slug: 'alexandra', name: 'Alexandra', role: 'Chef', note: 'Invited by Maurice · 1 pending config proposal' }
];
