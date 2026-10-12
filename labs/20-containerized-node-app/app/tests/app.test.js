import test from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../app.js";

test("GET /health doit retourner un statut 200 et { ok: true }", async () => {
  const app = await buildApp();
  try {
    const response = await app.inject({
      method: "GET",
      url: "/health",
    });
    
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { ok: true });
  } finally {
    // Le bloc finally garantit que l'application se ferme proprement
    // même si une assertion échoue, évitant les fuites de mémoire.
    await app.close();
  }
});

test("GET /route-inexistante doit retourner une erreur 404", async () => {
  const app = await buildApp();
  try {
    const response = await app.inject({
      method: "GET",
      url: "/route-inexistante",
    });
    
    assert.equal(response.statusCode, 404);
  } finally {
    await app.close();
  }
});