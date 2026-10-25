# Valostats BR — tracker Valorant em português

## Mettre en ligne (une seule fois)
1. Crée un compte sur https://developer.riotgames.com et génère une clé API.
2. Mets ce dossier sur GitHub, puis importe-le sur https://vercel.com (gratuit).
3. Dans Vercel > Settings > Environment Variables, ajoute RIOT_API_KEY = ta clé.
4. Deploy. Chaque modification poussée sur GitHub se redéploie toute seule.

## Notes
- La clé « development » expire toutes les 24 h : suffisant pour tester.
- Pour les données de matchs Valorant en continu, il faut demander une clé « production » à Riot (formulaire dans le portail développeur).
