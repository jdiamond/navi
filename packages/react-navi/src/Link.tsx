import * as React from 'react'
import { join as pathJoin } from 'path'
import { URLDescriptor, Navigation, createURLDescriptor, HTTPMethod } from 'navi'
import { NaviContext } from './NaviContext'
import { scrollToHash } from './scrollToHash';


export interface LinkProps {
  active?: boolean,
  activeClassName?: string,
  activeStyle?: object,
  children?: any,
  className?: string,
  disabled?: boolean,
  exact?: boolean,
  hidden?: boolean,
  href: string | Partial<URLDescriptor>,
  id?: string,
  lang?: string,
  prefetch?: HTTPMethod,
  ref?: React.Ref<HTMLAnchorElement>,
  rel?: string,
  style?: object,
  tabIndex?: number,
  target?: string,
  title?: string,
  onClick?: React.MouseEventHandler<HTMLAnchorElement>,

  render?: (props: LinkRendererProps) => any,
}

export interface LinkRendererProps {
  active: boolean,
  activeClassName?: string,
  activeStyle?: object,
  children: any,
  className?: string,
  disabled?: boolean,
  tabIndex?: number,
  hidden?: boolean,
  href: string,
  id?: string,
  lang?: string,
  style?: object,
  target?: string,
  title?: string,
  onClick: React.MouseEventHandler<any>,
} 


export const LinkContext = React.createContext<LinkContext>(undefined as any)

export interface LinkContext {
  url: URLDescriptor | undefined;
  handleClick: (event: React.MouseEvent<HTMLAnchorElement>) => void;
  anchorRef: React.Ref<HTMLAnchorElement>

  id?: string;
  lang?: string;
  rel?: string;
  tabIndex?: number;
  target?: string;
  title?: string;
  href?: string;
}


export class LinkAnchor extends React.Component<React.AnchorHTMLAttributes<HTMLAnchorElement>> {
  render() {
    return <LinkContext.Consumer children={this.renderChildren} />
  }

  renderChildren = (context: LinkContext) => {
    let linkURL = context.url
    let handleClick: React.MouseEventHandler<HTMLAnchorElement> = context.handleClick
    if (this.props.onClick) {
      handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
        this.props.onClick!(e)
        if (!e.defaultPrevented) {
          context.handleClick(e)
        }
      }
    }

    return (
      <a
        id={context.id}
        lang={context.lang}
        ref={context.anchorRef}
        rel={context.rel}
        tabIndex={context.tabIndex}
        target={context.target}
        title={context.title}

        {...this.props}

        href={linkURL ? linkURL.href : context.href as string}
        onClick={handleClick}
      />
    )
  }
}


export namespace Link {
  export type Props = LinkProps
  export type RendererProps = LinkRendererProps
}

// Need to include this type definition, as the automatically generated one
// is incompatible with some versions of the react typings.
export const Link: (React.ComponentClass<LinkProps & React.ClassAttributes<HTMLAnchorElement>> & {
  Anchor: typeof LinkAnchor;
}) | (React.StatelessComponent<LinkProps & React.ClassAttributes<HTMLAnchorElement>> & {
  Anchor: typeof LinkAnchor;
}) = Object.assign(
  React.forwardRef((props: LinkProps, anchorRef: React.Ref<HTMLAnchorElement>) => (
    <NaviContext.Consumer>
      {context => <InnerLink {...props as any} context={context} anchorRef={anchorRef} />}
    </NaviContext.Consumer>
  )),
  { Anchor: LinkAnchor }
)

Link.defaultProps = {
  render: (props: LinkRendererProps) => {
    let {
      active,
      activeClassName,
      activeStyle,
      children,
      className,
      hidden,
      style,
    } = props

    return (
      <LinkAnchor
        children={children}
        className={`${className || ''} ${(active && activeClassName) || ''}`}
        hidden={hidden}
        style={Object.assign({}, style, active ? activeStyle : {})}
      />
    )
  },
  prefetch: 'HEAD'
}


interface InnerLinkProps extends LinkProps {
  context: NaviContext
  anchorRef: React.Ref<HTMLAnchorElement>
}

class InnerLink extends React.Component<InnerLinkProps> {
  navigation: Navigation

  static defaultProps = {
    prefetch: true,
  }

  constructor(props: InnerLinkProps) {
    super(props)

    let url = this.getURL()
    let navigation = props.context.navigation
    if (navigation && url && url.pathname && props.prefetch) {
      navigation.router.resolve(url, {
        method: props.prefetch,
        followRedirects: true,
      })
        .catch((e) => {
          console.warn(
            `A <Link> referred to tried to prefetch "${url!.pathname}", but the ` +
            `router was unable to fetch this path.`
          )
        })
    }
  }

  getNavigationURL() {
    let context = this.props.context
    let route = (context.steadyRoute || context.busyRoute)
    return route && route.url
  }

  getURL(): URLDescriptor | undefined  {
    let href = this.props.href

    // If this is an external link, return undefined so that the native
    // response will be used.
    if (!href || (typeof href === 'string' && ((href.indexOf('://') !== -1 || href.indexOf('mailto:') === 0)))) {
      return
    }

    // The route `pathname` should always end with a `/`, so this
    // will give us a consistent behavior for `.` and `..` links.
    let navigationURL = this.getNavigationURL()
    if (navigationURL && typeof href === 'string' && href[0] === '.') {
      href = pathJoin(navigationURL.pathname, href)
    }

    return createURLDescriptor(href)
  }
  
  render() {
    let props = this.props
    let navigationURL = this.getNavigationURL()
    let linkURL = this.getURL()
    let active = props.active !== undefined ? props.active : !!(
      linkURL &&
      navigationURL &&
      (props.exact
        ? linkURL.pathname === navigationURL.pathname
        : navigationURL.pathname.indexOf(linkURL.pathname) === 0)
    )

    let context = {
      url: linkURL,
      handleClick: this.handleClick,

      ...props,

      href: typeof props.href === 'string' ? props.href : (linkURL ? linkURL.href : '')
    }

    return (
      <LinkContext.Provider value={context} >
        {props.render!({
          active,
          activeClassName: props.activeClassName,
          activeStyle: props.activeStyle,
          children: props.children,
          className: props.className,
          disabled: props.disabled,
          tabIndex: props.tabIndex,
          hidden: props.hidden,
          href: linkURL ? linkURL.href : props.href as string,
          id: props.id,
          lang: props.lang,
          style: props.style,
          target: props.target,
          title: props.title,
          onClick: this.handleClick,
        })}
      </LinkContext.Provider>
    )
  }

  handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    // Let the browser handle the event directly if:
    // - The user used the middle/right mouse button
    // - The user was holding a modifier key
    // - A `target` property is set (which may cause the browser to open the
    //   link in another tab)
    if (event.button === 0 &&
        !(event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)) {

      if (this.props.disabled) {
        event.preventDefault()
        return
      }

      if (this.props.onClick) {
        this.props.onClick(event)
      }
      
      // Let the browser handle targets natively
      if (this.props.target) {
        return
      }
      
      let url = this.getURL()
      if (!event.defaultPrevented && url) {
        event.preventDefault()

        let currentURL = (this.props.context.busyRoute || this.props.context.steadyRoute)!.url
        let isSamePathname = url.pathname === currentURL.pathname
        if ((!isSamePathname && url.pathname !== '') || url.hash !== currentURL.hash) {
          this.props.context.navigation.history.push(url)
        }
        else {
          // Don't keep pushing the same URL onto the history.
          this.props.context.navigation.history.replace(url)
          if (url.hash) {
            scrollToHash(currentURL.hash, 'smooth')
          }
        }
      }
    }
  }
}
