# Problèmes du système actuel

| Domaine | Problème | Conséquence | Solution proposée |
| :--- | :--- | :--- | :--- |
| **Scalabilité & Disponibilité** | Un seul Pod exécute un unique réplica de `quote-api`. | Le moindre crash, OOM ou redémarrage provoque une coupure totale du service ; impossible d'absorber un pic de trafic. | Déployer `quote-api` via un `Deployment` avec plusieurs réplicas (`>= 2–3`) répartis sur plusieurs nœuds derrière un `Service`. |
| **Persistance & Couplage** | PostgreSQL tourne dans le même conteneur que l'application et écrit dans la couche éphémère du conteneur. | Tout redémarrage ou redéploiement efface entièrement la base de données ; impossible de scaler ou redémarrer l'API et la BDD indépendamment. | Isoler PostgreSQL dans son propre `StatefulSet` (ou BDD managée) adossé à un `PersistentVolumeClaim` (PVC) sur un stockage durable. |
| **Sécurité des déploiements** | Stratégie de mise à jour `Recreate` : l'ancien Pod est arrêté avant la création du nouveau. | Coupure de service garantie à chaque déploiement, et aucune protection si la nouvelle image est défectueuse. | Passer à `RollingUpdate` (`maxUnavailable: 0`, `maxSurge: 1`) conditionné par des sondes de disponibilité (*readiness probes*). |
| **Détection des pannes** | Aucune sonde (*readiness* ou *liveness probe*) configurée. | Kubernetes envoie du trafic vers des Pods non prêts ou cassés, et ne redémarre jamais un processus bloqué. | Ajouter une `readinessProbe` HTTP (ex. `/health/ready` vérifiant la connexion BDD) et une `livenessProbe` (`/health/live`). |
| **Gestion des ressources** | Aucune `request` ni `limit` CPU/mémoire définie. | Une fuite mémoire ou un pic de charge peut saturer le nœud et provoquer des OOM-kill sur d'autres workloads. | Définir des `requests` et `limits` réalistes pour `quote-api` et PostgreSQL, complétées par une `LimitRange`. |
| **Gestion des secrets** | Les identifiants BDD sont écrits en clair dans les variables d'environnement des manifestes Git. | Toute personne ayant accès au dépôt (ou à l'historique Git) récupère les accès BDD ; la rotation des mots de passe impose de modifier le code. | Référencer un `Secret` Kubernetes (`secretKeyRef`) provisionné hors Git (External Secrets Operator, Sealed Secrets ou CI/CD). |
| **Infrastructure & Reprise** | Un seul nœud et un seul disque local, sans procédure de sauvegarde/restauration testée. | La perte de la VM ou du disque entraîne à la fois une panne totale et une perte définitive des données. | Déployer sur plusieurs nœuds avec anti-affinité, utiliser un stockage réseau répliqué et planifier des sauvegardes hors cluster avec tests de restauration réguliers. |

---

# Architecture de production

*(Légende : `[Vérifié Lab 52]` = briques validées en lab ; `[Proposé]` = améliorations pour la production.)*

```mermaid
flowchart TB
    U[Utilisateurs / Clients] --> LB[Ingress / LoadBalancer<br/>Terminaison TLS]

    subgraph Cluster["Cluster Kubernetes [Proposé : Multi-Nœuds]"]
        LB --> SVC_API[Service : quote-api ClusterIP<br/>Vérifié Lab 52]

        subgraph Node1["Nœud Worker 1 [Proposé]"]
            API1[Pod : quote-api #1<br/>Sondes + Limites]
            API2[Pod : quote-api #2<br/>Sondes + Limites]
        end

        subgraph Node2["Nœud Worker 2 [Proposé]"]
            API3[Pod : quote-api #3<br/>Sondes + Limites]
            PG[StatefulSet : postgres-0<br/>Sondes + Limites]
        end

        SVC_API --> API1
        SVC_API --> API2
        SVC_API --> API3

        API1 --> SVC_PG[Service : postgres ClusterIP<br/>Proposé]
        API2 --> SVC_PG
        API3 --> SVC_PG
        SVC_PG --> PG

        SEC[Secret K8s : db-credentials<br/>Provisionné via External Secrets / CI<br/>Proposé] -.-> API1
        SEC -.-> API2
        SEC -.-> API3
        SEC -.-> PG
    end

    PG --> PVC[PVC -> Stockage Bloc Réseau<br/>Proposé]
    PG -. "pg_dump planifié / archivage WAL" .-> BKP[Sauvegardes Stockage Objet Hors Cluster<br/>Restauration testée - Proposé]