import React from 'react'
import PropTypes from 'prop-types'
import styled from 'styled-components'
import * as props from './props'
import { GitRef } from './GitRef'
import { PathLine } from '../graph/pathline'
import { GraphColumnWidth, GraphIndent, RowHeight } from './constants'
import { colours } from '../../lib/theme'
import _ from 'lodash'

const Colours = colours.GRAPH_NODES

const RowWrapper = styled.div`
  display: flex;
  flex-direction: row;

  padding-right: 3px;
  padding-left: 3px;

  align-items: center;

  :hover {
    background-color: ${colours.OVERLAY.HINT};
  }

  color: ${colours.TEXT.DEFAULT};
`
const selectedStyle = { backgroundColor: colours.OVERLAY.FOCUS }
const headStyle = { fontWeight: 'bold', color: colours.TEXT.FOCUS }

const RowColumn = styled.div`
  display: flex;
  flex-direction: row;

  margin-right: 10px;
  max-height: 100%;

  overflow: hidden;
`

const ColumnText = styled.div`
  display: flex;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

export class Row extends React.Component {
  handleSelect = () => {
    const { commit, onSelect } = this.props
    onSelect(commit)
  }

  handleDoubleClick = () => {
    const { commit, onDoubleClick } = this.props
    onDoubleClick(commit)
  }

  getWrapperStyle() {
    const { height, selected, isHead } = this.props

    return {
      height,
      ...(selected ? selectedStyle : {}),
      ...(isHead ? headStyle : {}),
    }
  }

  render() {
    const { columns, commit } = this.props

    return (
      <RowWrapper
        style={this.getWrapperStyle()}
        onClick={this.handleSelect}
        onDoubleClick={this.handleDoubleClick}>
        {columns.map((column) => (
          <RowColumn key={column.key} style={{ width: column.width }}>
            {column.showTags && this.renderRefs()}

            {column.key === 'graph' ? (
              this.renderGraphItem()
            ) : (
              <ColumnText>{commit[column.key]}</ColumnText>
            )}
          </RowColumn>
        ))}
      </RowWrapper>
    )
  }

  renderRefs() {
    const { refs } = this.props

    const [branches, tags] = _.partition(refs, (ref) => ref.type === 'branch')
    const [upstreamBranches, localBranches] = _.partition(
      branches,
      (branch) => branch.isRemote,
    )

    // If both local and remote heads are on this commit, just display one
    const pairedRefs = []
    for (const localBranch of localBranches) {
      const upstreamBranchIndex = upstreamBranches.findIndex(
        (other) => other.id === localBranch.upstream?.name,
      )

      if (upstreamBranchIndex >= 0) {
        upstreamBranches.splice(upstreamBranchIndex, 1)
      }
      pairedRefs.push({
        ref: localBranch,
        remoteInSync: upstreamBranchIndex >= 0,
      })
    }
    pairedRefs.push(
      ...upstreamBranches.map((ref) => ({
        ref,
      })),
    )
    pairedRefs.push(
      ...tags.map((tag) => ({
        ref: tag,
      })),
    )

    return pairedRefs.map(({ ref, remoteInSync = false }) => (
      <GitRef
        key={ref.id}
        label={ref.name}
        current={ref.isHead}
        remoteInSync={remoteInSync}
        type={ref.type}
      />
    ))
  }

  renderGraphItem() {
    const { node, linksBefore, linksAfter } = this.props
    if (!node) {
      return null
    }

    return (
      <svg>
        {linksBefore.map((link) => (
          <PathLine
            key={JSON.stringify(link)}
            points={this.getPathLinePoints(link, 0)}
            stroke={Colours[link.colour % Colours.length]}
            strokeWidth={3}
            fill="none"
            r={2}
          />
        ))}
        {linksAfter.map((link) => (
          <PathLine
            key={JSON.stringify(link)}
            points={this.getPathLinePoints(link, 1)}
            stroke={Colours[link.colour % Colours.length]}
            strokeWidth={3}
            fill="none"
            r={2}
          />
        ))}
        <circle
          key={node.sha}
          cx={GraphIndent + node.column * GraphColumnWidth}
          cy={RowHeight / 2}
          r={5}
          fill={
            Colours[
              (node.secondaryColour
                ? node.secondaryColour
                : node.primaryColour) % Colours.length
            ]
          }
          strokeWidth={3}
          stroke={Colours[node.primaryColour % Colours.length]}
        />
      </svg>
    )
  }

  getPathLinePoints(link, indexOffset = 0) {
    const x1 = link.x1 * GraphColumnWidth + GraphIndent
    const y1 = -RowHeight / 2 + indexOffset * RowHeight
    const x2 = link.x2 * GraphColumnWidth + GraphIndent
    const y2 = RowHeight / 2 + indexOffset * RowHeight

    return [
      ...(link.nodeAtStart
        ? [{ x: x1, y: y1 }]
        : [
            { x: x1, y: y1 },
            { x: x1, y: y1 + 3 },
          ]),
      x1 < x2
        ? { x: x2, y: y1 + RowHeight / 2 }
        : { x: x1, y: y2 - RowHeight / 2 },
      ...(link.nodeAtEnd
        ? [{ x: x2, y: y2 }]
        : [
            { x: x2, y: y2 - 3 },
            { x: x2, y: y2 },
          ]),
    ]
  }
}

Row.propTypes = {
  selected: PropTypes.bool,
  onSelect: PropTypes.func,
  onDoubleClick: PropTypes.func,
  columns: props.columns,
  refs: props.refs,
  commit: props.commit,
  node: PropTypes.object.isRequired,
  linksBefore: PropTypes.array.isRequired,
  linksAfter: PropTypes.array.isRequired,
  height: PropTypes.number.isRequired,
}
