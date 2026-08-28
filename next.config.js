/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        // aplica em todas as rotas
        source: "/:path*",
        headers: [
          // impede que o site seja carregado dentro de um <iframe> em outro
          // domínio (proteção contra clickjacking)
          { key: "X-Frame-Options", value: "DENY" },
          // impede o navegador de "adivinhar" o tipo de um arquivo diferente
          // do Content-Type declarado (mitiga alguns ataques de XSS)
          { key: "X-Content-Type-Options", value: "nosniff" },
          // não manda a URL completa de origem quando o usuário clica num
          // link que sai do site (evita vazar paths internos/sensíveis)
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // desliga acesso a APIs sensíveis do navegador (câmera, microfone,
          // geolocalização) que o ERP não usa
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
