/**
 * Proxy Universal "En Caliente" (Optimizado para Navegador y listas M3U)
 */
export default {
  async fetch(request, env) {
    try {
      if (request.method !== "GET") {
        return new Response("Method Not Allowed", { status: 405 });
      }

      const requestUrl = new URL(request.url);
      const targetUrl = requestUrl.searchParams.get('url');
      const pass = requestUrl.searchParams.get('pass');

      if (!targetUrl) {
        return new Response("Falta el parámetro ?url=", { status: 400 });
      }

      if (!env.PROXY_PASSWORD) {
        return new Response("Error de configuración en Cloudflare", { status: 500 });
      }

      if (pass !== env.PROXY_PASSWORD) {
        return new Response("Acceso Denegado", { status: 403 });
      }

      let parsedTarget;
      try {
        parsedTarget = new URL(targetUrl);
      } catch {
        return new Response("La URL proporcionada no es válida", { status: 400 });
      }

      // Limpiamos el rastro antes de pedir la URL de destino
      const modifiedHeaders = new Headers(request.headers);
      modifiedHeaders.delete("Referer");

      // Hacemos la petición (seguimos redirecciones, muy importante para los .m3u)
      const proxyResponse = await fetch(parsedTarget, {
        method: "GET",
        headers: modifiedHeaders,
        redirect: "follow" 
      });

      // Devolvemos el archivo blindando el navegador del usuario
      return new Response(proxyResponse.body, {
        status: proxyResponse.status,
        headers: {
          "Content-Type": proxyResponse.headers.get("Content-Type") || "text/plain",
          "Access-Control-Allow-Origin": "*",
          "Referrer-Policy": "no-referrer" // El parche anti-fugas de tu contraseña
        }
      });

    } catch (error) {
      return new Response("Error interno del Proxy", { status: 500 });
    }
  },
};
