import { Link } from 'react-router-dom'

export function TopBar(props: { title: string; backTo?: string }) {
  return (
    <header className="topBar">
      {props.backTo ? (
        <Link className="iconButton" to={props.backTo} aria-label="Back">
          ←
        </Link>
      ) : (
        <span className="iconButtonPlaceholder" />
      )}
      <div className="topBarTitle">{props.title}</div>
      <span className="iconButtonPlaceholder" />
    </header>
  )
}

