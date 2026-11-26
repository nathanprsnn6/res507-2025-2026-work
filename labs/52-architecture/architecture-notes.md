1. System Architecture Diagram

+-----------------------------------------------------------------------------------+
|                              Host Hardware (Physical PC)                          |
|                                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  |                               Hypervisor (VM)                               |  |
|  |                                                                             |  |
|  |  +-----------------------------------------------------------------------+  |  |
|  |  |                 Ubuntu VM (Kubernetes Node) - Guest Kernel            |  |  |
|  |  |                                                                       |  |  |
|  |  |   +---------------------------------------------------------------+   |  |  |
|  |  |   |                           Kubernetes                          |   |  |  |
|  |  |   |                                                               |   |  |  |
|  |  |   |       [App Service] <-------------------- (In-cluster client) |   |  |  |
|  |  |   |             |                                                 |   |  |  |
|  |  |   |             v (Load Balancing)                                |   |  |  |
|  |  |   |  +-----------------------------------------+                  |   |  |  |
|  |  |   |  |             App Deployment              |                  |   |  |  |
|  |  |   |  |  +-------+    +-------+    +-------+    |                  |   |  |  |
|  |  |   |  |  | Pod 1 |    | Pod 2 |    | Pod 3 |<------- (Port-Forward)|   |  |  |
|  |  |   |  |  +-------+    +-------+    +-------+    |                  |   |  |  |
|  |  |   |  +-----------------------------------------+                  |   |  |  |
|  |  |   |                                                               |   |  |  |
|  |  |   |  - - - - - - - - - Planned / Prévu - - - - - - - - - - - - -  |   |  |  |
|  |  |   |                                                               |   |  |  |
|  |  |   |       [Database Service]                                      |   |  |  |
|  |  |   |             |                                                 |   |  |  |
|  |  |   |             v                                                 |   |  |  |
|  |  |   |       [PostgreSQL Pod] ---------> [PVC (Persistent Storage)]  |   |  |  |
|  |  |   +---------------------------------------------------------------+   |  |  |
|  |  +-----------------------------------------------------------------------+  |  |
|  +-----------------------------------------------------------------------------+  |
+-----------------------------------------------------------------------------------+
                                                                  ^
                                                                  |
                                                           [Browser / Laptop]


Traffic Paths vs. Boundaries:

Port-Forward : Le trafic venant du navigateur contourne la répartition de charge et pointe directement vers un seul Pod applicatif.

In-cluster client : Le trafic interne (vérifié dans le Lab 42) passe par l'App Service, qui assure le vrai load balancing vers les 3 Pods du déploiement.

2. Kernel & Boundaries
Les conteneurs de l'application et de la base de données (sur ce nœud) partagent le noyau invité (guest kernel) de la machine virtuelle Ubuntu. L'hyperviseur fournit la barrière d'isolement matérielle de la VM, tandis que Kubernetes se contente de gérer les charges de travail à l'intérieur de cet environnement invité.

3. Resilience and Failures (What survives?)
Remplacement des App Pods : Un Pod applicatif peut être détruit et remplacé sans aucun risque car l'application est stateless (elle ne stocke pas de données locales).

Survie de la base de données : Les données (citations) survivront au remplacement du Pod PostgreSQL car elles sont sauvegardées en dehors du cycle de vie du conteneur grâce au Persistent Volume Claim (PVC).

Limite de résilience (Storage/Failure Boundary) : Bien que nous ayons trois répliques, elles fonctionnent toutes sur une seule et même machine virtuelle en utilisant un stockage local (local-path). Par conséquent, la perte de cette VM ou de son disque physique entraînera une perte totale et irrécupérable des données. La conception d'un cluster multi-nœuds et la mise en place de sauvegardes de production seront nécessaires à l'avenir.


 5. Database Check Results

A. Bound PVC (Stockage persistant attaché) :**
tetras@devops-vm:~/res507-2025-2026-work$ kubectl get pvc -n quote-lab
NAME            STATUS   VOLUME                                     CAPACITY   ACCESS MODES   STORAGECLASS   VOLUMEATTRIBUTESCLASS   AGE
quote-db-data   Bound    pvc-9b8e4a63-2702-4e0e-a6bc-27b26c5837c2   1Gi        RWO            local-path     <unset>                 111m

B. Database Pod Replacement (Noms de l'ancien et nouveau Pod DB) :

Plaintext
NAME                        READY   STATUS    RESTARTS      AGE
quote-app-6c44c759f-72wj2   1/1     Running   1 (31m ago)   28d
quote-app-6c44c759f-ghtxt   1/1     Running   0             47s
quote-app-6c44c759f-lqmjp   1/1     Running   1 (31m ago)   28d
quote-db-644978d54-tqh4v    1/1     Running   0             23m
quote-db-644978d54-tqh4v    1/1     Terminating   0             23m
quote-db-644978d54-kchhv    0/1     Pending       0             0s
quote-db-644978d54-tqh4v    1/1     Terminating   0             23m
quote-db-644978d54-kchhv    0/1     Pending       0             1s
quote-db-644978d54-kchhv    0/1     ContainerCreating   0             1s
quote-db-644978d54-kchhv    0/1     ContainerCreating   0             6s
quote-db-644978d54-tqh4v    0/1     Completed           0             23m
quote-db-644978d54-tqh4v    0/1     Completed           0             23m
quote-db-644978d54-tqh4v    0/1     Completed           0             23m
quote-db-644978d54-kchhv    0/1     Running             0             8s
quote-db-644978d54-kchhv    1/1     Running             0             15s

C. Data Persistence (Survie des données) :

Before replacement (Avant suppression) : curl -s http://127.0.0.1:8080 | gre
p RES509
    <div>— RES509</div>
    <div>— RES509</div>
    <div>— RES509</div>

After replacement (Après redémarrage) : curl -s http://127.0.0.1:8080 | gre
p RES509
    <div>— RES509</div>
    <div>— RES509</div>
    <div>— RES509</div>

6. Prochaine action / Limitation
Limitation principale : La configuration actuelle repose entièrement sur un stockage local (local-path) lié à une seule machine virtuelle Ubuntu. Si cette VM ou son disque virtuel tombe en panne, la base de données sera définitivement perdue, malgré la présence du PVC.
Prochaine action : Implémenter un cluster Kubernetes multi-nœuds et mettre en place une stratégie de sauvegarde externe robuste pour la base de données PostgreSQL afin de garantir une véritable viabilité en production.