# GodPrompt hosted service privacy notice

**Proposed publication text ? operator review required**

This notice covers the public GodPrompt remote tool service, including the GodPrompt Engineering plugin. It supplements the publisher's [website privacy policy](https://tomiseregi.si/privacy). The controller and contact are identified there. Questions and privacy requests may be sent through [the publisher's contact page](https://tomiseregi.si/contact).

## Data and purposes

The service receives the selected tool name, structured tool arguments that the client submits, and ordinary HTTPS/protocol information needed to receive and respond to the request. Tool arguments may contain engineering descriptions, examples, paths, requirements, code excerpts and reported test evidence. The service uses them to compute the requested advisory result. No account, payment information or sign-in is needed for this public endpoint. Do not submit credentials, personal information, confidential code, unredacted logs, payment data, health data or government identifiers. Submit synthetic, minimized or appropriately redacted examples instead.

Processing is intended to be limited to delivering the requested tool function and maintaining the security and reliability of the service. The operator must confirm the applicable legal bases before approving this notice.

## Storage and recipients

The public Worker is stateless: the request arguments are processed for the request and are not written by the public tool implementation to an application database, a conversation archive or a user-profile store. The public route does not use the legacy Durable Object for storage. No third-party model inference is called by these tools. The operator does not intentionally retain tool payloads after the response or use them for behavioral profiling, advertising, or model training.

The production Worker is hosted by Cloudflare. Cloudflare processes requests and network metadata in order to deliver and protect the service. Its [privacy policy](https://www.cloudflare.com/privacypolicy/) and [customer data processing addendum](https://www.cloudflare.com/cloudflare-customer-dpa/) describe its role and international processing arrangements. Worker Logs, Traces and Issues were disabled when the production settings were reviewed; no observability export was configured. The operator must verify that these settings and applicable provider security/operational retention arrangements remain accurate before approval. Cloudflare's [Workers Logs documentation](https://developers.cloudflare.com/workers/observability/logs/workers-logs/) describes the separate retention limits for that optional feature.

The calling client, such as ChatGPT or Codex, controls its own conversation history and data handling. Its privacy settings and policies apply separately. Support correspondence is handled according to the publisher's website privacy policy, which describes the retention of inquiries and applicable legal obligations.

## User controls

You may stop sending data by not invoking the remote tools or by removing the plugin from your client. You can also use the standalone Skill without the remote service. For applicable access, correction, deletion, restriction, objection, portability or other rights, contact the publisher through the contact page; the website privacy policy explains the available rights and complaint routes. The operator must confirm the process for provider-held metadata and deletion requests before this notice is finalized.
