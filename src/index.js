import auth from 'solid-auth-client';
import {
    addStringNoLocale,
    createSolidDataset,
    createThing,
    saveSolidDatasetAt,
    setThing,
    getSolidDataset,
    getContainedResourceUrlAll,
} from "@inrupt/solid-client"
import { fetch as solid_fetch, getDefaultSession, handleIncomingRedirect, onSessionRestore } from "@inrupt/solid-client-authn-browser"

import {createDocument, fetchDocument} from "tripledoc"
import {schema} from 'rdf-namespaces';
import {RDF} from '@inrupt/vocab-common-rdf'


function log (html_message)
{
    const text_el = document.createElement("span")
    text_el.innerHTML = html_message
    document.body.appendChild(text_el)
    document.body.appendChild(document.createElement("br"))
}


async function getWebId(identityProvider) {
    const solid_session = getDefaultSession()
    log(solid_session.info.isLoggedIn ? "logged in" : "not logged in")

    // const session = await auth.currentSession();
    // if (session) {
    //     return session.webId;
    // }
    // await auth.login(identityProvider);

    if (!solid_session.info.isLoggedIn)
    {
        await start_login(identityProvider)
    }
    return solid_session.info.webId
}



async function start_login (oidcIssuer)
{
    const session = getDefaultSession()

    if (oidcIssuer && !session.info.isLoggedIn)
    {
        const args = {
            oidcIssuer,
            clientName: "demo",
            redirectUrl: window.location.href,
        }
        log("Logging into solid session with: " + JSON.stringify(args))
        await session.login(args)
    }

    return session.info.webId
}



async function finish_login ()
{
    await handleIncomingRedirect({ restorePreviousSession: true })
}



function getDocumentUrlFromWebId (webId, path)
{
    const a = document.createElement('a');
    a.href = webId;
    return `${a.protocol}//${a.hostname}/private/${path}`;
}


function addButton(value, clickHandler) {
    let element = document.createElement("input");
    element.type = "button";
    element.value = value;
    element.name = value;
    element.onclick = clickHandler

    document.body.appendChild(element);
    document.body.appendChild(document.createElement("br"))
}

(async function () {
    onSessionRestore((url) => {
        log("session restored with url: " + url)
        if (document.location.toString() !== url) history.replaceState(null, "", url)
    })


    await finish_login()
    const webId = await getWebId("https://solidcommunity.net");

    log(`Sign in with webId "${webId}"`)


    addButton("1. Create doc -- Working", async function () {
        let items_dataset = createSolidDataset()
        let thing = createThing({ name: "123" })
        thing = addStringNoLocale(thing, "http://example.com/schema/title", "some title")
        items_dataset = setThing(items_dataset, thing)

        const documentUrl = getDocumentUrlFromWebId(webId, `tmp/demo_bug/tripledoc-${Math.random()}.ttl`)
        log("Creating: " + documentUrl)
        await saveSolidDatasetAt(documentUrl, items_dataset, { fetch: solid_fetch })
        log("done create one")
    })


    addButton("2. Then fetch directory -- Works but logs 401", async function () {
        const documentUrl = getDocumentUrlFromWebId(webId, `tmp/demo_bug`)
        log("attempting to get: " + documentUrl)

        try
        {
            const dataset = await getSolidDataset(documentUrl, { fetch: solid_fetch })
            const urls = await getContainedResourceUrlAll(dataset)
            log("done getting, got urls: " + urls)
        }
        catch (err)
        {
            log("error whilst getting: " + err)
        }

    })

})();
