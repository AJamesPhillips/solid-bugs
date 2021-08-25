import {
    addDate,
    addStringNoLocale,
    createSolidDataset,
    createThing,
    deleteSolidDataset,
    getDate,
    getIri,
    getSolidDataset,
    getStringNoLocale,
    getThing,
    getThingAll,
    saveSolidDatasetAt,
    setThing,
} from "@inrupt/solid-client"
import {
    fetch as solid_fetch,
    getDefaultSession,
    handleIncomingRedirect,
    onSessionRestore,
} from "@inrupt/solid-client-authn-browser"



function log (html_message)
{
    const text_el = document.createElement("span")
    text_el.innerHTML = html_message
    document.body.appendChild(text_el)
    document.body.appendChild(document.createElement("br"))
    console.log(html_message)
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
}



async function get_solid_users_name_and_pod_URL ()
{
    const session = getDefaultSession()
    const empty = { user_name: "", default_solid_pod_URL: "" }

    const web_id = session.info.webId
    if (!session.info.isLoggedIn || !web_id) return empty

    // The web_id can contain a hash fragment (e.g. `#me`) to refer to profile data
    // in the profile dataset. If we strip the hash, we get the URL of the full
    // dataset.
    const profile_document_url = new URL(web_id)

    profile_document_url.hash = ""

    // To write to a profile, you must be authenticated. That is the role of the fetch
    // parameter in the following call.
    // TODO: can we drop the use of the fetch as someone's profile name is always public?
    const user_profile_dataset = await getSolidDataset(profile_document_url.href, {
        fetch: session.fetch
    })

    // The profile data is a "Thing" in the profile dataset.
    const profile = getThing(user_profile_dataset, web_id)

    if (!profile) return empty

    // Using the name provided in text field, update the name in your profile.
    // VCARD.fn object from "@inrupt/vocab-common-rdf" is a convenience object that
    // includes the identifier string "http://www.w3.org/2006/vcard/ns#fn".
    // As an alternative, you can pass in the "http://www.w3.org/2006/vcard/ns#fn" string instead of VCARD.fn.
    let user_name = getStringNoLocale(profile, "http://www.w3.org/2006/vcard/ns#fn") || ""

    if (!user_name)
    {
        user_name = getStringNoLocale(profile, "http://xmlns.com/foaf/0.1/name") || ""
    }

    const default_solid_pod_URL = getIri(profile, "http://www.w3.org/ns/pim/space#storage") || ""


    return {
        user_name,
        default_solid_pod_URL,
    }
}



async function finish_login ()
{
    await handleIncomingRedirect({ restorePreviousSession: true })
}



function addButton(value, clickHandler)
{
    let element = document.createElement("input")
    element.type = "button"
    element.value = value
    element.name = value
    element.onclick = clickHandler

    document.body.appendChild(element)
    document.body.appendChild(document.createElement("br"))
}



(async function () {
    onSessionRestore((url) => {
        log("session restored with url: " + url)
        if (document.location.toString() !== url) history.replaceState(null, "", url)
    })

    await finish_login()
    const solid_session = getDefaultSession()
    log(solid_session.info.isLoggedIn ? `Logged in with ${solid_session.info.webId}` : "Logged out")

    if (solid_session.info.isLoggedIn)
    {
        addButton(`0a. log out`, async function () {
            solid_session.logout()
            document.location.reload()
        })
    }
    else
    {
        addButton(`0b. log into solidcommunity.net`, async function () {
            start_login("https://solidcommunity.net/")
        })


        addButton(`0c. log into inrupt.com`, async function () {
            start_login("https://broker.pod.inrupt.com/")
        })
    }


    const get_document_url = async () =>
    {
        const pod_URL = (await get_solid_users_name_and_pod_URL(solid_session)).default_solid_pod_URL
        // return `${pod_URL}tmp123tmp123tmp123tmp123tmp123/tripledoc-12345.ttl`
        return `${pod_URL}tripledoc-123456.ttl`
    }


    addButton("1. Create doc", async function () {
        let items_dataset = createSolidDataset()
        let thing = createThing({ name: Math.round(Math.random() * 10000).toString() })
        thing = addStringNoLocale(thing, "http://example.com/schema/title", "some title")
        thing = addDate(thing, "http://example.com/schema/datetime", new Date())
        items_dataset = setThing(items_dataset, thing)

        const documentUrl = await get_document_url()

        log("Creating (first deleting because pod.inrupt.com is not compliant with documentation): " + documentUrl)

        try
        {
            await deleteSolidDataset(documentUrl, { fetch: solid_fetch })
        }
        catch (err)
        {
            if (!err || (err.statusCode !== 404)) console.error("Error deleting ", err)
        }

        log("Creating: " + documentUrl)
        await saveSolidDatasetAt(documentUrl, items_dataset, { fetch: solid_fetch })
        log("done create one")
    })


    addButton("2. Then fetch file", async function () {
        const documentUrl = await get_document_url()
        log("attempting to get: " + documentUrl)

        try
        {
            const dataset = await getSolidDataset(documentUrl, { fetch: solid_fetch })
            const all_things = getThingAll(dataset)
            log("done getting, got all things: " + JSON.stringify(all_things))

            all_things.forEach(thing =>
            {
                const title = getStringNoLocale(thing, "http://example.com/schema/title")
                const date = getDate(thing, "http://example.com/schema/datetime")
                log("done getting, got title: " + JSON.stringify(title))
                log("done getting, got date: " + JSON.stringify(date))
            })

        }
        catch (err)
        {
            log("error whilst getting: " + err)
        }

    })

})()
