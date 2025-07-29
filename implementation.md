# Placement - a dinner party seating web app
## Overview:
We are building a dinner party seating web app. User can create an account to generate seating arrangements or teams for dinner parties. Users begin by creating a "party" which will consist of a collection of meals or events with the same group.
Meals created in a party let the user make PLACEMENT.
Events created in a party let the user make TEAMS.

### Placement:
Seating arrangements are generated via CP-SAT using a variety of rules:
1. Try not to seat two family members or significant others (SOs) next to one another
2. Try to seat alternating boy/girl (or non binary)
3. Try not to seat two people together who sat next to one another at another meal in this party

Each arrangement is givena  score (with penalisation for things we DONT want) and CP-SAT finds a close to optimal arrangement

### Teams:
Team arrangements will be like so: make n teams of m people. Teams will be created again as an assignment problem with the following rules:
1. Try not to put two family members or SOs on the same team
2. Try to mix genders in teams
3. Try not to put two people together who sat next to one another at another meal or event in this party

Additionally, users can choose a "fair play" option where they will rank the ability of guests at the given event and the app will create teams that balance out ability (if fair play is chosen, creating fair teams becomes the #1 priority).

NOTE: whenever a placement or team arrangement is made, the user is given the top 6 options.
After the placement/teams are made, users can still drag and drop names to move them around! There's also a reset button to return it to the generated state.

## Details:
When creating a new party, users add guests to the party. They can either add a new guest's name, or if the name of the guest being added is recognised as one from a previous party, they can just add that guest (whose profile will be complete with gender and a list of family/SOs). When a new guest is added, the user is prompted to input gender (man/woman/nonbinary) and is prompted to check off any family members/SOs already in the guest list or else add their profile.

Note that if someone is added to a guest's list of family members/SOs then that relationship is RECIPROCAL.

## Design/UI:
We will use Next.js 14 (React 18 + app router) + TypeScript and dnd-kit or @hello-pangea/dnd for drag and drop functions.
Note that all svgs needed for this project can be found in the folder public/assets.
The fonts used are both google fonts: PT Serif and Playwrite US Modern
Colours: White, black and grey (F5F5F5)

## Backend:
Data and auth will use supabase, and we will use CP-SAT to solve assignment.
