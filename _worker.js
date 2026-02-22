/**
 * Proxy Universal "En Caliente" con Parche HTML
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

      // Hacemos la petición a la web original
      const proxyResponse = await fetch(parsedTarget, {
        method: "GET",
        headers: modifiedHeaders,
        redirect: "follow" 
      });

      // Miramos qué tipo de archivo nos ha devuelto
      const contentType = proxyResponse.headers.get("Content-Type") || "";
      let responseToReturn;

      // EL PARCHE: Si es una página web, inyectamos la etiqueta <base>
      if (contentType.includes("text/html")) {
        responseToReturn = new HTMLRewriter()
          .on("head", {
            element(e) {
              // Le decimos al navegador cuál es la ruta base real para las imágenes y estilos
              e.prepend(`<base href="${parsedTarget.href}">`, { html: true });
            }
          })
          .transform(proxyResponse);
      } else {
        // Si no es HTML (es un .m3u, un .zip, un .mp4...), lo dejamos tal cual
        responseToReturn = proxyResponse;
      }

      // Preparamos las cabeceras finales de seguridad
      const finalHeaders = new Headers(responseToReturn.headers);
      finalHeaders.set("Access-Control-Allow-Origin", "*");
      finalHeaders.set("Referrer-Policy", "no-referrer");

      // Devolvemos el resultado final a tu navegador
      return new Response(responseToReturn.body, {
        status: responseToReturn.status,
        statusText: responseToReturn.statusText,
        headers: finalHeaders
      });

    } catch (error) {
      return new Response("Error interno del Proxy", { status: 500 });
    }
  },
};
