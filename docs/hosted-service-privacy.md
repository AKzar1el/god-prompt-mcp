# GodPrompt hosted service privacy notice

**Effective: 24 November 2026**

This notice covers the public hosted GodPrompt remote tool service, including the GodPrompt Engineering plugin for ChatGPT and Codex. It supplements the [publisher's website privacy policy](https://tomiseregi.si/privacy) for the remote service. The controller is Tomi ?eregi, Slovenia. Contact details and the privacy email address are available in that policy and on the [contact page](https://tomiseregi.si/contact).

## 1. Data received and why

- **Tool requests and responses:** the selected tool name, structured engineering arguments supplied by your client (such as requirements, code examples, paths, dependency graphs and reported test evidence), and the advisory output. The remote service uses these to answer the specific request. It does not retrieve your repositories, local files, account data or conversation history independently.
- **Technical data:** information necessary to establish and respond to HTTPS and MCP requests, such as request identifiers, protocol/client metadata, and network information (which can include an IP address). The hosting provider processes technical information to deliver and protect the service.
- **Support correspondence:** if you contact the publisher, the contact details and message you provide are used to resolve your inquiry, as described in the website privacy policy.

No separate GodPrompt account, payment details or authentication credentials are required. The service is designed for non-sensitive engineering inputs. Do not submit access credentials (including passwords, API keys or one-time codes), payment card data, protected health information, government identifiers, confidential source material or other personal or sensitive information. Use synthetic or appropriately redacted, minimal examples. Supplying personal information in tool arguments is not required. Without the necessary engineering arguments and connection information, a requested tool may be unable to return a result.

## 2. Legal bases

Where personal data is involved, processing necessary to provide the service requested by an individual is based on Article 6(1)(b) GDPR where applicable. Otherwise, limited processing necessary to operate the requested service, prevent abuse and maintain its security and reliability is based on the publisher's legitimate interests under Article 6(1)(f), subject to applicable safeguards and the right to object. Correspondence is processed on the bases described in the website privacy policy. Data may also be processed where necessary to comply with a legal obligation (Article 6(1)(c)). The service does not rely on advertising consent or use personal data to make legally or similarly significant automated decisions about individuals.

## 3. Storage and retention

The public Worker processes tool arguments and results for the duration of the request. Its application does not write them to a database, durable storage, conversation archive or user-profile store, and does not intentionally retain copies of those payloads after the response. The legacy Durable Object is not used by the public MCP route. The service does not call third-party AI inference providers or use tool inputs for model training, advertising or behavioral profiling.

Cloudflare may process and retain network, security and operational information separately from the application's in-request processing. Retention of this infrastructure information depends on the purpose, nature and sensitivity of the information, security needs, contractual obligations and applicable legal requirements; Cloudflare does not specify a single retention duration applicable to all such data. See the data-retention section of [Cloudflare's privacy policy](https://www.cloudflare.com/privacypolicy/). The production Worker has no configured observability export, Logpush or external log consumers as of the effective date. This is not a promise that Cloudflare retains no infrastructure records.

Support inquiries are retained as needed to resolve them and, where no business relationship follows, for no longer than 12 months, consistent with the publisher's website privacy policy. Records relating to an actual business relationship are retained as required by applicable Slovenian tax and accounting law. Other records are retained only as necessary for applicable legal obligations.

## 4. Recipients and international transfers

Cloudflare, Inc. provides hosting, network delivery and security. Cloudflare and its authorized subprocessors may process data needed to deliver these services. See [Cloudflare's customer data processing addendum](https://www.cloudflare.com/cloudflare-customer-dpa/) and [privacy policy](https://www.cloudflare.com/privacypolicy/) for its processing arrangements and safeguards. The publisher does not sell tool payloads or disclose them for advertising. Data may be disclosed when required by law.

Cloudflare operates internationally, including outside the European Economic Area. Its published data processing addendum describes the applicable international-transfer safeguards, including the EU Standard Contractual Clauses where required. Contact the publisher for information about applicable safeguards or a copy of the relevant provisions.

Your calling client (for example, ChatGPT or Codex) receives the result and handles its own conversation history, account information and data settings under its applicable privacy policies. The publisher cannot delete records held separately by that client. Support communications use the channels and providers described in the publisher's website privacy policy.

## 5. Your rights and controls

You may stop sending requests by not invoking the remote tools or by removing the plugin from your client. The standalone Skill can be used without the remote service. Subject to applicable law, you may request access, rectification, erasure, restriction, portability or object to legitimate-interest processing. Contact the publisher through the [contact page](https://tomiseregi.si/contact) or the privacy email listed in the [website privacy policy](https://tomiseregi.si/privacy). The publisher will respond within the GDPR's applicable time limits, request only information reasonably needed to identify the request, and seek assistance from its processor as necessary. Because the application maintains no user account or stored tool-request history, it may not have a stored copy to retrieve or erase.

You may also complain to the [Information Commissioner of the Republic of Slovenia](https://www.ip-rs.si/en/data-protection/how-to-file-an-application) or another competent supervisory authority.

## 6. Changes

This notice will be updated when the hosted service's data-handling practices change. The current version is available at this URL. The effective date identifies the version of the notice.
