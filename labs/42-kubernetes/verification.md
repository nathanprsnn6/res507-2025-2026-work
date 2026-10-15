1. Baseline Verification

A. Three Ready Replicas:
tetras@devops-vm:~/res507-2025-2026-work/labs/42-kubernetes$ kubectl get pods -n quote-lab
NAME                         READY   STATUS    RESTARTS   AGE
quote-app-7d6744749f-6wcbh   1/1     Running   0          48m
quote-app-7d6744749f-fwwhz   1/1     Running   0          48m
quote-app-7d6744749f-j44r7   1/1     Running   0          9m56s

B. Forwarded Health Request:
tetras@devops-vm:~/res507-2025-2026-work/labs/42-kubernetes$ curl http://localhost:8080/health
Handling connection for 8080
{"ok":true}







2. Reconciliation

A.Deleted and replacement Pod names:

tetras@devops-vm:~/res507-2025-2026-work/labs/42-kubernetes$ kubectl get pods -l app=quote-app -w
NAME                         READY   STATUS    RESTARTS   AGE
quote-app-7d6744749f-9cxwb   1/1     Running   0          88s
quote-app-7d6744749f-fwwhz   1/1     Running   0          58m
quote-app-7d6744749f-j44r7   1/1     Running   0          19m
quote-app-7d6744749f-9cxwb   1/1     Terminating   0          2m1s
quote-app-7d6744749f-kv7hn   0/1     Pending       0          0s
quote-app-7d6744749f-9cxwb   1/1     Terminating   0          2m1s
quote-app-7d6744749f-kv7hn   0/1     Pending       0          0s
quote-app-7d6744749f-kv7hn   0/1     ContainerCreating   0          0s
quote-app-7d6744749f-kv7hn   0/1     ContainerCreating   0          0s
quote-app-7d6744749f-kv7hn   0/1     Running             0          1s
quote-app-7d6744749f-9cxwb   0/1     Error               0          2m2s
quote-app-7d6744749f-9cxwb   0/1     Error               0          2m2s
quote-app-7d6744749f-9cxwb   0/1     Error               0          2m2s
quote-app-7d6744749f-kv7hn   1/1     Running             0          6s






3. Failure Diagnosis and Recovery

A.Symptom: After applying a bad readiness probe, the new Pod remains stuck in the 0/1 Ready state, and the deployment rollout is paused. The old pods continue running to serve traffic.

B. Cause: The readinessProbe path was deliberately changed to /broken. The Kubernetes kubelet received an HTTP 404 Not Found error because the Express server does not have this route configured.

C. Fix: Restored the probe path back to /health in the deployment.yaml and reapplied. The kubelet receives an HTTP 200 OK, marks the Pod as 1/1 Ready, and successfully completes the rollout.

D. Probe Failure Event:
tetras@devops-vm:~/res507-2025-2026-work/labs/42-kubernetes$ kubectl get pods -n quote-lab
NAME                         READY   STATUS    RESTARTS   AGE
quote-app-7d6744749f-fwwhz   1/1     Running   0          76m
quote-app-7d6744749f-j44r7   1/1     Running   0          37m
quote-app-7d6744749f-kv7hn   1/1     Running   0          17m
quote-app-86b6685b64-zjfq7   0/1     Running   0          7s
5b64-zjfq7 -n quote-lab
tetras@devops-vm:~/res507-2025-2026-work/labs/42-kubernetes$ kubectl describe pod quote-app-86b6685b64-zjfq7 -n quote-lab
Name:             quote-app-86b6685b64-zjfq7
Namespace:        quote-lab
Priority:         0
Service Account:  default
Node:             devops-vm/10.0.2.15
Start Time:       Thu, 15 Oct 2026 09:34:57 +0000
Labels:           app=quote-app
                  pod-template-hash=86b6685b64
Annotations:      <none>
Status:           Running
IP:               10.42.0.21
IPs:
  IP:           10.42.0.21
Controlled By:  ReplicaSet/quote-app-86b6685b64
Containers:
  quote-app:
    Container ID:   containerd://766186a7df8a1ded5889d4f93087b809e2fed96115fdd844198c310da55fb4d5
    Image:          quote-app:local
    Image ID:       sha256:9d6fac681b41c528b2519e04b622341ad9f5b1e8679fd08961154f768e49a64e
    Port:           3000/TCP
    Host Port:      0/TCP
    State:          Running
      Started:      Thu, 15 Oct 2026 09:34:57 +0000
    Ready:          False
    Restart Count:  0
    Readiness:      http-get http://:3000/broken delay=3s timeout=1s period=5s #success=1 #failure=3
    Environment:    <none>
    Mounts:
      /var/run/secrets/kubernetes.io/serviceaccount from kube-api-access-j7txq (ro)
Conditions:
  Type                        Status
  PodReadyToStartContainers   True 
  Initialal:                false
    DownwardAPI:             true
QoS Class:                   BestEffort
Node-Selectors:              <none>
Tolerations:                 node.kubernetes.io/not-ready:NoExecute op=Exists for 300s
                             node.kubernetes.io/unreachable:NoExecute op=Exists for 300s
Events:
  Type     Reason     Age               From               Message
  ----     ------     ----              ----               -------
  Normal   Scheduled  2m6s              default-scheduler  Successfully assigned quote-lab/quote-app-86b6685b64-zjfq7 to devops-vm
  Normal   Pulled     2m6s              kubelet            spec.containers{quote-app}: Container image "quote-app:local" already present on machine and can be accessed by the pod
  Normal   Created    2m6s              kubelet            spec.containers{quote-app}: Container created
  Normal   Started    2m6s              kubelet            spec.containers{quote-app}: Container startedized                 True 
  Ready                       False 
  ContainersReady             False 
  PodScheduled                True 
Volumes:
  kube-api-access-j7txq:
    Type:                    Projected (a volume that contains injected data from multiple sources)
    TokenExpirationSeconds:  3607
    ConfigMapName:           kube-root-ca.crt
    Option
  Warning  Unhealthy  4s (x25 over 2m)  kubelet            spec.containers{quote-app}: Readiness probe failed: HTTP probe failed with statuscode: 404

E.Recovered Rollout:
tetras@devops-vm:~/res507-2025-2026-work/labs/42-kubernetes$ kubectl get pods
NAME                         READY   STATUS    RESTARTS   AGE
quote-app-7d6744749f-fwwhz   1/1     Running   0          73m
quote-app-7d6744749f-j44r7   1/1     Running   0          34m
quote-app-7d6744749f-kv7hn   1/1     Running   0          14m






4. Extension: Resource Limits and Requests

A. Change: Added `requests` (100m CPU / 128Mi RAM) and `limits` (250m CPU / 256Mi RAM) to the container spec in `deployment.yaml`.

B. Verification Result:
```bash
[Copiez-collez ici l'extrait de 'kubectl describe pod <nom-du-pod>' montrant le bloc "Limits:" et "Requests:"]
```

C. What it demonstrates: This demonstrates resource management and cluster stability. It ensures the application is only scheduled on a node with sufficient baseline resources (requests) and prevents a single pod with a memory leak from crashing the entire host node by enforcing a hard ceiling (limits), resulting in an OOMKilled termination instead of a node failure.