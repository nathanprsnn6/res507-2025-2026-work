# Problèmes du système actuel

* **Un seul Pod pour l'API :** Il n'y a qu'un seul réplica de `quote-api`. Si le conteneur plante ou redémarre, le service est complètement coupé et on ne peut pas encaisser de pic de trafic.  
  *Fix :* Passer sur un `Deployment` avec 2 ou 3 réplicas répartis sur plusieurs nœuds, exposés derrière un `Service`.

* **Base de données dans le même conteneur que l'API :** PostgreSQL tourne dans le même conteneur que l'app et écrit dans le stockage temporaire. Au moindre redémarrage, toutes les données disparaissent, et impossible de mettre à jour l'API sans couper la BDD.  
  *Fix :* Séparer PostgreSQL dans son propre `StatefulSet` avec un `PVC` monté sur un stockage persistant.

* **Mises à jour en `Recreate` :** L'ancien Pod est détruit avant que le nouveau soit créé, ce qui impose une coupure à chaque déploiement.  
  *Fix :* Utiliser `RollingUpdate` (`maxUnavailable: 0`) pour remplacer les Pods un par un sans coupure.

* **Pas de sondes (probes) :** Sans `readinessProbe` ni `livenessProbe`, Kubernetes envoie du trafic vers un Pod qui n'est pas encore prêt et ne redémarre pas un conteneur bloqué.  
  *Fix :* Ajouter des sondes HTTP sur l'API (`/health/ready` et `/health/live`) et une sonde sur PostgreSQL.

* **Aucune limite de ressources :** Sans `requests` ni `limits`, une fuite mémoire sur l'API peut saturer toute la machine et faire tomber le reste.  
  *Fix :* Définir des limites CPU et RAM raisonnables sur chaque conteneur.

* **Mots de passe en clair sur Git :** Les identifiants de la BDD sont écrits en dur dans les fichiers YAML. N'importe qui avec accès au repo a les accès à la base.  
  *Fix :* Utiliser un `Secret` Kubernetes injecté hors Git (via CI/CD ou External Secrets / Sealed Secrets).

* **Un seul serveur et pas de backups :** Tout repose sur une seule VM et son disque local. Si la machine lâche, on perd le service et les données.  
  *Fix :* Prévoir au moins deux nœuds, un stockage réseau, et des sauvegardes automatiques hors du cluster (avec des tests de restauration).

---

# Architecture de production

*(Ce qui est déjà validé dans mon Lab 52 est marqué `[Lab 52]`, le reste correspond à mes ajouts `[Proposé]`.)*

```mermaid
flowchart TB
    Users[Utilisateurs] --> Ingress[Ingress / HTTPS - Proposé]
    Ingress --> SvcAPI[Service quote-api - Lab 52]

    subgraph Cluster [Cluster Kubernetes - Multi-nœuds Proposé]
        subgraph N1 [Nœud 1]
            API1[Pod quote-api 1]
            API2[Pod quote-api 2]
        end

        subgraph N2 [Nœud 2]
            API3[Pod quote-api 3]
            DB[StatefulSet postgres-0]
        end

        SvcAPI --> API1
        SvcAPI --> API2
        SvcAPI --> API3

        API1 & API2 & API3 --> SvcDB[Service postgres interne - Proposé]
        SvcDB --> DB

        Secret[Secret K8s - hors Git] -.-> API1 & API2 & API3 & DB
    end

    DB --> PVC[PVC sur stockage réseau - Proposé]
    DB -. pg_dump / WAL .-> Backup[Backups externes S3 - Proposé]
